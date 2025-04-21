import { LogLevel } from '@azure/msal-common'
import { NodeSystemOptions } from '@azure/msal-node'
import { Logger } from '~/logger'
import { createNetworkClient } from './accountSystems/OAuthNetworkClient'

export function createNodeSystemOptions(logger: Logger, fetch: typeof globalThis.fetch, signal?: AbortSignal, transformReqResp = false): NodeSystemOptions {
  const client = createNetworkClient(fetch, signal)
  return {
    loggerOptions: {
      logLevel: LogLevel.Verbose,
      loggerCallback: (level, message, ppi) => {
        logger.log(`${message}`)
      },
    },
    networkClient: {
      sendGetRequestAsync: async (url, options, token) => {
        const response = await client.sendGetRequestAsync(url, options, token)
        // override well-known openid-configuration
        if (transformReqResp) {
          if (url.endsWith('.well-known/openid-configuration')) {
            // @ts-ignore
            response.body.authorization_endpoint = response.body.device_authorization_endpoint
          }
        }
        return response as any
      },
      sendPostRequestAsync: async (url, options) => {
        if (transformReqResp && options) {
          if (options.body?.indexOf('grant_type=device_code') !== -1) {

            const original = new URLSearchParams(options.body);
            const params = new URLSearchParams()
            params.append('client_id', original.get('client_id')!)
            params.append('device_code', original.get('device_code')!)
            params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code')
            // options.body = options.body?.replace('grant_type=device_code', 'grant_type=urn:ietf:params:oauth:grant-type:device_code')
            options.body = params.toString()
          } else if (options.body.indexOf('scope=') !== -1) {
            // remove profile scope
            options.body = options.body.replace('%20profile', '')
          }
        }

        return client.sendPostRequestAsync(url, options) as any
      },
    },
  }
}