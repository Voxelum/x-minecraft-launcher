import { INetworkModule, NetworkRequestOptions } from '@azure/msal-common';

export function createNetworkClient(fetch: typeof global.fetch, signal?: AbortSignal): INetworkModule {
  const doFetch = async (method: string, url: string, options: NetworkRequestOptions, token?: number) => {
    const response = await fetch(url, {
      method,
      headers: options?.headers,
      body: options?.body,
      signal,
    })

    let body = await response.text()
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        body = JSON.parse(body)
      } catch (e) {
        // ignore
      }
    }

    return {
      body,
      // @ts-ignore
      headers: Object.fromEntries(response.headers),
      status: response.status,
    }
  }
  return {
    sendGetRequestAsync: async (url, options, token) => {
      // @ts-ignore
      return doFetch('GET', url, options, token) as Promise<NetworkResponse<any>>
    },
    sendPostRequestAsync: async (url, options) => {
       // @ts-ignore
       return doFetch('POST', url, options) as Promise<NetworkResponse<any>>
    },
  }
}