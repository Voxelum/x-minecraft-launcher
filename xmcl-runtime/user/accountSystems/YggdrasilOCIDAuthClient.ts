import { DeviceCodeResponse } from '@azure/msal-common'
import { AuthenticationResult, PublicClientApplication } from '@azure/msal-node'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/logger'
import { AnyError } from '~/util/error'
import { createNodeSystemOptions } from '../NodeSystemOptions'
import { createPlugin } from '../credentialPlugin'

export class YggdrasilOCIDAuthClient {
  constructor(
    private fetch: typeof global.fetch,
    private logger: Logger,
    private deviceCodeCallback: (deviceCodeResponse: DeviceCodeResponse) => void,
    private storage: SecretStorage,
  ) {
  }

  protected async getOAuthApp(authority: string, clientId: string, account: string, signal?: AbortSignal) {
    return new PublicClientApplication({
      auth: {
        authority: authority,
        knownAuthorities: [authority],
        clientId: clientId,
        protocolMode: 'OIDC',
        azureCloudOptions: {
          azureCloudInstance: 'none',
        }
      },
      cache: {
        cachePlugin: createPlugin('xmcl-oauth', account, this.logger, this.storage),
      },
      system: createNodeSystemOptions(this.logger, this.fetch, signal, true),
    })
  }

  async authenticate(
    authority: string,
    clientId: string,
    username: string,
    scopes: string[],
    options: {
      signal?: AbortSignal
      slientOnly?: boolean
      homeAccountId?: string
      extraScopes?: string[]
    } = {}) {
    const app = await this.getOAuthApp(authority, clientId, username, options.signal)
    if (options.homeAccountId) {
      const accounts = await app.getTokenCache().getAllAccounts().catch(() => [])
      const account = accounts.find(a => a.homeAccountId === options.homeAccountId)
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
      throw new AnyError('YggdrasilOCIDAuthClientSlientFailed', 'Fail to acquire Microsoft token silently.')
    }

    let result: AuthenticationResult | null = null
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
