import { Constants, DeviceCodeResponse } from '@azure/msal-common'
import { AuthenticationResult, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { Dispatcher, request } from 'undici'
import { createPlugin } from '../credentialPlugin'
import { Logger } from '~/logger'
import { SecretStorage } from '~/app/SecretStorage'

export class MicrosoftOAuthClient {
  constructor(
    private logger: Logger,
    readonly clientId: string,
    private getCode: (url: string, signal?: AbortSignal) => Promise<string>,
    private getRedirectUrl: (preferLocalHost: boolean) => Promise<string>,
    private deviceCodeCallback: (deviceCodeResponse: DeviceCodeResponse) => void,
    private storage: SecretStorage,
    private dispatcher?: Dispatcher,
  ) {
  }

  protected async getOAuthApp(account: string, signal?: AbortSignal) {
    const dispatcher = this.dispatcher
    return new PublicClientApplication({
      auth: {
        authority: 'https://login.microsoftonline.com/consumers/',
        clientId: this.clientId,
      },
      cache: {
        cachePlugin: createPlugin('xmcl', account, this.logger, this.storage),
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Verbose,
          loggerCallback: (level, message, ppi) => {
            this.logger.log(`${message}`)
          },
        },
        networkClient: {
          async sendGetRequestAsync(url, options, token) {
            const response = await request(url, {
              method: 'GET',
              headers: options?.headers,
              body: options?.body,
              bodyTimeout: token,
              headersTimeout: token,
              signal,
              dispatcher,
            })

            const body = await response.body.json() as any

            if ((response.statusCode < 200 || response.statusCode > 299) && // do not destroy the request for the device code flow
              body.error !== Constants.AUTHORIZATION_PENDING) {
              throw new Error(`HTTP status code ${response.statusCode}`)
            }

            return {
              body,
              headers: response.headers as any,
              status: response.statusCode,
            }
          },
          async sendPostRequestAsync(url, options) {
            const response = await request(url, {
              method: 'POST',
              headers: options?.headers,
              body: options?.body,
              dispatcher,
              signal,
            })

            const body = await response.body.json() as any

            if ((response.statusCode < 200 || response.statusCode > 299) && // do not destroy the request for the device code flow
              body.error !== Constants.AUTHORIZATION_PENDING) {
              throw new Error(`HTTP status code ${response.statusCode}`)
            }

            return {
              body,
              headers: response.headers as any,
              status: response.statusCode,
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
