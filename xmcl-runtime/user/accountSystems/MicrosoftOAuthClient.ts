import { Constants, DeviceCodeResponse } from '@azure/msal-common'
import { AuthenticationResult, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/logger'
import { AnyError } from '~/util/error'
import { createPlugin } from '../credentialPlugin'

export class MicrosoftOAuthClient {
  constructor(
    private fetch: typeof global.fetch,
    private logger: Logger,
    readonly clientId: string,
    private getCode: (url: string, signal?: AbortSignal) => Promise<string>,
    private getRedirectUrl: (preferLocalHost: boolean) => Promise<string>,
    private deviceCodeCallback: (deviceCodeResponse: DeviceCodeResponse) => void,
    private storage: SecretStorage,
  ) {
  }

  protected async getOAuthApp(account: string, signal?: AbortSignal) {
    return new PublicClientApplication({
      auth: {
        authority: 'https://login.microsoftonline.com/consumers/',
        clientId: this.clientId,
      },
      cache: {
        cachePlugin: createPlugin('xmcl-oauth', account, this.logger, this.storage),
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Verbose,
          loggerCallback: (level, message, ppi) => {
            this.logger.log(`${message}`)
          },
        },
        networkClient: {
          sendGetRequestAsync: async (url, options, token) => {
            const response = await this.fetch(url, {
              method: 'GET',
              headers: options?.headers,
              body: options?.body,
              signal,
            })

            const body = await response.json()

            if ((response.status < 200 || response.status > 299) && // do not destroy the request for the device code flow
              body.error !== Constants.AUTHORIZATION_PENDING) {
              throw new Error(`HTTP status code ${response.status}`)
            }

            return {
              body,
              // @ts-ignore
              headers: Object.fromEntries(response.headers),
              status: response.status,
            }
          },
          sendPostRequestAsync: async (url, options) => {
            const response = await this.fetch(url, {
              method: 'POST',
              headers: options?.headers,
              body: options?.body,
              signal,
            })

            const body = await response.json()

            if ((response.status < 200 || response.status > 299) && // do not destroy the request for the device code flow
              body.error !== Constants.AUTHORIZATION_PENDING) {
              throw new Error(`HTTP status code ${response.status}`)
            }

            return {
              body,
              // @ts-ignore
              headers: Object.fromEntries(response.headers),
              status: response.status,
            }
          },
        },
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
  } = {}) {
    const app = await this.getOAuthApp(username, options.signal)
    if (username && !options?.code) {
      const accounts = await app.getTokenCache().getAllAccounts().catch(() => [])
      const account = accounts.find(a => a.username === username)
      if (account) {
        const result = await app.acquireTokenSilent({
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
              ? await app.acquireTokenSilent({
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

    let result: AuthenticationResult | null = null
    if (!options.useDeviceCode) {
      const redirectUri = await this.getRedirectUrl(options?.directRedirectToLauncher ?? false)
      let code = options.code
      if (!code) {
        const url = await app.getAuthCodeUrl({
          redirectUri,
          scopes,
          extraScopesToConsent: options.extraScopes,
          loginHint: username,
        })
        code = await this.getCode(url, options.signal)
      }
      result = await app.acquireTokenByCode({
        code,
        scopes,
        redirectUri,
      })
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
