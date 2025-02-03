import { Constants, LogLevel } from '@azure/msal-common'
import { NodeSystemOptions } from '@azure/msal-node'
import { Logger } from '~/logger'

export function createNodeSystemOptions(logger: Logger, fetch: typeof globalThis.fetch, signal?: AbortSignal, transformReqResp = false): NodeSystemOptions {
  return {
    loggerOptions: {
      logLevel: LogLevel.Verbose,
      loggerCallback: (level, message, ppi) => {
        logger.log(`${message}`)
      },
    },
    networkClient: {
      sendGetRequestAsync: async (url, options, token) => {
        const response = await fetch(url, {
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

        // override well-known openid-configuration
        if (transformReqResp) {
          if (url.endsWith('.well-known/openid-configuration')) {
            body.authorization_endpoint = body.device_authorization_endpoint
          }
        }

        return {
          body,
          // @ts-ignore
          headers: Object.fromEntries(response.headers),
          status: response.status,
        }
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

        const response = await fetch(url, {
          method: 'POST',
          headers: { ...options?.headers, Accept: 'application/json' },
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
  }
}