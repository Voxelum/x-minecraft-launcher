import { AccountInfo, DeviceCodeResponse, INativeBrokerPlugin } from '@azure/msal-common'
import { AuthenticationResult, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { AnyError } from '@xmcl/utils'
import { randomUUID } from 'crypto'
import { copyFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MicrosoftAuthTelemetryEvent } from '~/app'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/infra'
import { createPlugin } from '../credentialPlugin'
import { isNetworkError, isUserCanceledError } from './MicrosoftAuthErrors'
import { createNetworkClient } from './OAuthNetworkClient'

export const MICROSOFT_GRAPH_USER_READ_SCOPE = 'User.Read'
export const MICROSOFT_XBOX_LAUNCHER_SCOPES = [
  'XboxLive.signin',
  'XboxLive.offline_access',
  'offline_access',
]

let nativeBrokerRuntimePrepared = false
let nativeBrokerPlugin: INativeBrokerPlugin | undefined
let nativeBrokerPluginInitialized = false
let nativeBrokerPluginPromise: Promise<INativeBrokerPlugin | undefined> | undefined

interface MsalDiagnostic {
  status?: string
  errorCode?: string
}

function parseMsalDiagnostic(message: string): MsalDiagnostic {
  return {
    status: /StatusInternal::([^,\s]+)/.exec(message)?.[1],
    errorCode: /Error Code ([0-9]+)/.exec(message)?.[1],
  }
}

function getSafeErrorProperties(error: unknown) {
  const result: Record<string, string | number | boolean> = {}
  const toSafeCode = (value: unknown) => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    return /^[a-z0-9_.-]{1,128}$/i.test(text) ? text : undefined
  }
  const errorName = error instanceof Error ? toSafeCode(error.name) : undefined
  if (errorName) {
    result.errorName = errorName
  }
  const candidate = error as { errorCode?: unknown; subError?: unknown } | undefined
  const errorCode = toSafeCode(candidate?.errorCode)
  if (errorCode) {
    result.errorCode = errorCode
  }
  const subError = toSafeCode(candidate?.subError)
  if (subError) {
    result.subError = subError
  }
  return result
}

export class MicrosoftOAuthClient {
  constructor(
    private fetch: typeof global.fetch,
    private logger: Logger,
    readonly clientId: string,
    private getCode: (url: string, redirectUri: string, signal?: AbortSignal, authAttemptId?: string) => Promise<string>,
    private getRedirectUrl: (preferLocalHost: boolean) => Promise<string>,
    private deviceCodeCallback: (deviceCodeResponse: DeviceCodeResponse) => void,
    private storage: SecretStorage,
    private getWindowHandle?: () => Buffer | undefined,
    private emitTelemetry?: (event: MicrosoftAuthTelemetryEvent) => void,
  ) {
  }

  private async getNativeBrokerPlugin() {
    if (process.platform !== 'win32') {
      return undefined
    }
    if (nativeBrokerPluginInitialized) {
      return nativeBrokerPlugin
    }
    if (nativeBrokerPluginPromise) {
      return nativeBrokerPluginPromise
    }
    const operation = (async () => {
      try {
        this.prepareNativeBrokerRuntime()
        const { NativeBrokerPlugin } = await import('@azure/msal-node-extensions')
        const plugin = new NativeBrokerPlugin()
        return plugin.isBrokerAvailable ? plugin : undefined
      } catch (e) {
        this.logger.warn('Unable to load the Windows native broker plugin')
        this.logger.warn(e)
        return undefined
      }
    })()
    nativeBrokerPluginPromise = operation
    try {
      nativeBrokerPlugin = await operation
      nativeBrokerPluginInitialized = true
      return nativeBrokerPlugin
    } finally {
      if (nativeBrokerPluginPromise === operation) {
        nativeBrokerPluginPromise = undefined
      }
    }
  }

  private prepareNativeBrokerRuntime() {
    if (nativeBrokerRuntimePrepared) return

    const arch = process.arch === 'ia32' ? 'ia32' : 'x64'
    const target = join(tmpdir(), 'xmcl-msal-node-runtime', String(process.pid), arch)
    mkdirSync(target, { recursive: true })
    const targetNode = join(target, 'msal-node-runtime.node')
    copyFileSync(join(__dirname, `msal-node-runtime-${arch}.node`), targetNode)
    copyFileSync(join(__dirname, `msalruntime-${arch}.dll`), join(target, 'msalruntime.dll'))
    process.env.XMCL_MSAL_NODE_RUNTIME_PATH = targetNode
    nativeBrokerRuntimePrepared = true
  }

  protected async getOAuthApp(
    account: string,
    signal?: AbortSignal,
    nativeBrokerPlugin?: INativeBrokerPlugin,
    onDiagnostic?: (diagnostic: MsalDiagnostic) => void,
  ) {
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
          logLevel: LogLevel.Error,
          loggerCallback: (level, message) => {
            if (level === LogLevel.Error) {
              const diagnostic = parseMsalDiagnostic(message)
              onDiagnostic?.(diagnostic)
              const status = diagnostic.status ? `: ${diagnostic.status}` : ''
              const errorCode = diagnostic.errorCode ? ` (${diagnostic.errorCode})` : ''
              this.logger.warn(`Microsoft authentication diagnostic${status}${errorCode}`)
            }
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
    const telemetry = {
      attemptId: randomUUID(),
      startedAt: Date.now(),
      routeUsed: 'silent',
      fallbackUsed: false,
      cachedAccount: false,
      completed: false,
    }
    const track = (
      name: MicrosoftAuthTelemetryEvent['name'],
      properties: Record<string, string | number | boolean>,
      measurements?: Record<string, number>,
    ) => {
      this.emitTelemetry?.({
        name,
        properties: {
          authAttemptId: telemetry.attemptId,
          ...properties,
        },
        measurements,
      })
    }
    const complete = (outcome: string, error?: unknown) => {
      if (telemetry.completed) return
      telemetry.completed = true
      track('microsoft-auth-complete', {
        outcome,
        routeUsed: telemetry.routeUsed,
        fallbackUsed: telemetry.fallbackUsed,
        cachedAccount: telemetry.cachedAccount,
        ...getSafeErrorProperties(error),
      }, {
        durationMs: Date.now() - telemetry.startedAt,
      })
    }

    try {
      const nativeBrokerPlugin = options.useNativeBroker && !options.slientOnly
        ? await this.getNativeBrokerPlugin()
        : undefined
      const windowHandle = nativeBrokerPlugin ? this.getWindowHandle?.() : undefined
      track('microsoft-auth-start', {
        preferredFlow: options.slientOnly ? 'silent' : options.useDeviceCode ? 'device_code' : options.useNativeBroker ? 'wam' : 'webview',
        brokerRequested: Boolean(options.useNativeBroker),
        brokerAvailable: Boolean(nativeBrokerPlugin),
        windowHandleAvailable: Boolean(windowHandle),
        existingAccount: Boolean(username),
      })

      const cacheApp = await this.getOAuthApp(username, options.signal)
      let account: AccountInfo | undefined
      const allowSilentReuse = options.slientOnly || !options.useDeviceCode
      if (username && !options.code && allowSilentReuse) {
        const accounts = await cacheApp.getTokenCache().getAllAccounts().catch(() => [])
        // The token cache is shared by every Microsoft account, and
        // acquireTokenSilent keys off homeAccountId (it ignores username), so
        // the match must be exact.
        account = accounts.find(a => a.username.toLowerCase() === username.toLowerCase())
        telemetry.cachedAccount = Boolean(account)
        if (account) {
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
            complete('success')
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

      let brokerDiagnostic: MsalDiagnostic = {}
      const app = nativeBrokerPlugin && !options.useDeviceCode
        ? await this.getOAuthApp(username, options.signal, nativeBrokerPlugin, diagnostic => { brokerDiagnostic = diagnostic })
        : cacheApp
      let result: AuthenticationResult | null = null
      if (!options.useDeviceCode) {
        if (nativeBrokerPlugin) {
          telemetry.routeUsed = 'wam'
          const brokerStartedAt = Date.now()
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
              windowHandle,
            })
            if (account && result.account?.homeAccountId !== account.homeAccountId) {
              track('microsoft-auth-broker-result', {
                outcome: 'account_mismatch',
                fallbackReason: 'different_account',
                ...(brokerDiagnostic.status ? { msalStatus: brokerDiagnostic.status } : {}),
                ...(brokerDiagnostic.errorCode ? { msalInternalErrorCode: brokerDiagnostic.errorCode } : {}),
              }, {
                durationMs: Date.now() - brokerStartedAt,
              })
              this.logger.warn(`Windows native broker returned a different account for ${username}; falling back to OAuth redirect`)
              result = null
            } else {
              track('microsoft-auth-broker-result', {
                outcome: 'success',
                ...(brokerDiagnostic.status ? { msalStatus: brokerDiagnostic.status } : {}),
                ...(brokerDiagnostic.errorCode ? { msalInternalErrorCode: brokerDiagnostic.errorCode } : {}),
              }, {
                durationMs: Date.now() - brokerStartedAt,
              })
            }
          } catch (e) {
            const canceled = isUserCanceledError(e)
            track('microsoft-auth-broker-result', {
              outcome: canceled ? 'user_cancelled' : 'error',
              ...getSafeErrorProperties(e),
              ...(brokerDiagnostic.status ? { msalStatus: brokerDiagnostic.status } : {}),
              ...(brokerDiagnostic.errorCode ? { msalInternalErrorCode: brokerDiagnostic.errorCode } : {}),
            }, {
              durationMs: Date.now() - brokerStartedAt,
            })
            if (canceled) {
              throw e
            }
            this.logger.warn('Windows native broker authentication failed; falling back to OAuth redirect')
            this.logger.warn(e)
          }
        }
        if (!result) {
          telemetry.routeUsed = options.code ? 'authorization_code' : 'webview'
          telemetry.fallbackUsed = Boolean(nativeBrokerPlugin)
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
            code = await this.getCode(url, redirectUri, options.signal, telemetry.attemptId)
          }
          result = await app.acquireTokenByCode({
            code,
            scopes,
            redirectUri,
          })
        }
      } else {
        telemetry.routeUsed = 'device_code'
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

      complete('success')
      return {
        result: result!,
        extra,
      }
    } catch (e) {
      complete(
        options.signal?.aborted
          ? 'aborted'
          : (e as Error | undefined)?.name === 'MicrosoftOAuthSlientFailed'
            ? 'silent_miss'
          : isUserCanceledError(e)
            ? 'user_cancelled'
            : isNetworkError(e)
              ? 'network_error'
              : 'error',
        e,
      )
      throw e
    }
  }
}
