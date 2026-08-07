import { AccountInfo, DeviceCodeResponse, INativeBrokerPlugin } from '@azure/msal-common'
import { AuthenticationResult, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { AnyError } from '@xmcl/utils'
import { copyFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/infra'
import { createPlugin } from '../credentialPlugin'
import { createNetworkClient } from './OAuthNetworkClient'

export const MICROSOFT_GRAPH_USER_READ_SCOPE = 'User.Read'
export const MICROSOFT_XBOX_LAUNCHER_SCOPES = [
  'XboxLive.signin',
  'XboxLive.offline_access',
  'offline_access',
]

export class MicrosoftOAuthClient {
  private nativeBrokerPlugin: INativeBrokerPlugin | undefined

  constructor(
    private fetch: typeof global.fetch,
    private logger: Logger,
    readonly clientId: string,
    private getCode: (url: string, redirectUri: string, signal?: AbortSignal) => Promise<string>,
    private getRedirectUrl: (preferLocalHost: boolean) => Promise<string>,
    private deviceCodeCallback: (deviceCodeResponse: DeviceCodeResponse) => void,
    private storage: SecretStorage,
    private getWindowHandle?: () => Buffer | undefined,
  ) {
  }

  private async getNativeBrokerPlugin() {
    if (process.platform !== 'win32') {
      return undefined
    }
    if (!this.nativeBrokerPlugin) {
      try {
        this.prepareNativeBrokerRuntime()
        const { NativeBrokerPlugin } = await import('@azure/msal-node-extensions')
        this.nativeBrokerPlugin = new NativeBrokerPlugin()
      } catch (e) {
        this.logger.warn('Unable to load the Windows native broker plugin')
        this.logger.warn(e)
        return undefined
      }
    }
    return this.nativeBrokerPlugin.isBrokerAvailable ? this.nativeBrokerPlugin : undefined
  }

  private prepareNativeBrokerRuntime() {
    const arch = process.arch === 'ia32' ? 'ia32' : 'x64'
    const target = join(tmpdir(), 'xmcl-msal-node-runtime', String(process.pid), arch)
    mkdirSync(target, { recursive: true })
    const targetNode = join(target, 'msal-node-runtime.node')
    copyFileSync(join(__dirname, `msal-node-runtime-${arch}.node`), targetNode)
    copyFileSync(join(__dirname, `msalruntime-${arch}.dll`), join(target, 'msalruntime.dll'))
    process.env.XMCL_MSAL_NODE_RUNTIME_PATH = targetNode
  }

  protected async getOAuthApp(account: string, signal?: AbortSignal, nativeBrokerPlugin?: INativeBrokerPlugin) {
    return new PublicClientApplication({
      auth: {
        authority: 'https://login.microsoftonline.com/consumers/',
        clientId: this.clientId,
      },
      broker: nativeBrokerPlugin ? { nativeBrokerPlugin } : undefined,
      cache: {
        cachePlugin: createPlugin('xmcl-oauth', 'XMCL_MICROSOFT_ACCOUNT', this.logger, this.storage, [account]),
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Verbose,
          loggerCallback: (level, message, ppi) => {
            this.logger.log(`${message}`)
          },
        },
        networkClient: createNetworkClient(this.fetch, signal),
      },
    })
  }

  async authenticate(username: string, scopes: string[], options: {
    signal?: AbortSignal
    useDeviceCode?: boolean
    code?: string
    slientOnly?: boolean
    extraScopes?: string[]
    directRedirectToLauncher?: boolean
    useNativeBroker?: boolean
  } = {}) {
    const nativeBrokerPlugin = options.useNativeBroker ? await this.getNativeBrokerPlugin() : undefined
    const cacheApp = await this.getOAuthApp(username, options.signal)
    let account: AccountInfo | undefined
    if (username) {
      const accounts = await cacheApp.getTokenCache().getAllAccounts().catch(() => [])
      // The token cache is shared by every Microsoft account, and
      // acquireTokenSilent keys off homeAccountId (it ignores username), so
      // the match must be exact.
      account = accounts.find(a => a.username.toLowerCase() === username.toLowerCase())
      if (account && !options.code) {
        const result = await cacheApp.acquireTokenSilent({
          scopes,
          account,
          forceRefresh: false,
        }).catch((e) => {
          this.logger.warn(`Fail to acquire microsoft token silently for ${username}`)
          this.logger.warn(e)
          return null
        })
        if (result) {
          return {
            result,
            extra: options.extraScopes
              ? await cacheApp.acquireTokenSilent({
                scopes: options.extraScopes,
                account,
              }).catch((e) => {
                this.logger.warn(`Fail to acquire EXTRA microsoft token silently for ${username}`)
                this.logger.warn(e)
                return undefined
              }) ?? undefined
              : undefined,
          }
        }
      }
    }

    if (options.slientOnly) {
      throw new AnyError('MicrosoftOAuthSlientFailed', 'Fail to acquire Microsoft token silently.')
    }

    const app = nativeBrokerPlugin && !options.useDeviceCode
      ? await this.getOAuthApp(username, options.signal, nativeBrokerPlugin)
      : cacheApp
    let result: AuthenticationResult | null = null
    if (!options.useDeviceCode) {
      if (nativeBrokerPlugin) {
        try {
          result = await app.acquireTokenInteractive({
            scopes,
            extraScopesToConsent: options.extraScopes,
            account,
            loginHint: username || undefined,
            // Force the WAM account picker so the user can pick/add a
            // different account instead of silently logging in with the
            // account signed in to Windows. Without this, adding a second
            // Microsoft account always resolves to the Windows account.
            prompt: 'select_account',
            openBrowser: async () => {},
            windowHandle: this.getWindowHandle?.(),
          })
          if (account && result.account?.homeAccountId !== account.homeAccountId) {
            this.logger.warn(`Windows native broker returned a different account for ${username}; falling back to OAuth redirect`)
            result = null
          }
        } catch (e) {
          const message = e instanceof Error ? `${e.name} ${e.message}` : String(e)
          if (/(user[_ -]?cancel|access_denied)/i.test(message)) {
            throw e
          }
          this.logger.warn('Windows native broker authentication failed; falling back to OAuth redirect')
          this.logger.warn(e)
        }
      }
      if (!result) {
        const redirectUri = await this.getRedirectUrl(options?.directRedirectToLauncher ?? false)
        let code = options.code
        if (!code) {
          const url = await app.getAuthCodeUrl({
            redirectUri,
            scopes,
            extraScopesToConsent: options.extraScopes,
            loginHint: username,
            prompt: 'select_account',
          })
          code = await this.getCode(url, redirectUri, options.signal)
        }
        result = await app.acquireTokenByCode({
          code,
          scopes,
          redirectUri,
        })
      }
    } else {
      if (options.signal) {
        (options.signal as any).addEventListener('abort', () => {
          app.acquireTokenByDeviceCode({
            scopes,
            deviceCodeCallback: this.deviceCodeCallback,
            cancel: true,
          })
        })
      }
      result = await app.acquireTokenByDeviceCode({
        scopes,
        deviceCodeCallback: this.deviceCodeCallback,
      })
    }

    if (account && result!.account?.homeAccountId !== account.homeAccountId) {
      throw new AnyError(
        'MicrosoftOAuthAccountMismatch',
        `Microsoft authentication returned a different account than ${username}.`,
      )
    }

    let extra: AuthenticationResult | undefined
    if (options.extraScopes) {
      try {
        extra = await app.acquireTokenSilent({
          account: result!.account!,
          scopes: options.extraScopes,
        }) ?? undefined
      } catch (e) {
        if (e instanceof Error) {
          this.logger.error(e)
        } else {
          this.logger.error(new Error(`Fail to acquire extra result for ${username}` + JSON.stringify(e)))
        }
      }
    }

    return {
      result: result!,
      extra,
    }
  }
}
