export interface FetchBodyPair {
  primary: unknown
  fallback: unknown
  retryable: boolean
  cancelFallback(): Promise<void>
}

function headerValue(headers: HeadersInit | undefined, name: string) {
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const entry = Array.isArray(headers)
    ? headers.find(([key]) => key.toLowerCase() === name)
    : Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  return entry?.[1]
}

export function isReplayableFetchBody(headers: HeadersInit | undefined) {
  const contentType = headerValue(headers, 'content-type')
  return typeof contentType !== 'string' || !/^application\/(?:zip|octet-stream)(?:$|;)/i.test(contentType)
}

export function splitFetchBody(body: unknown, replayStream = true): FetchBodyPair {
  if (!body || typeof body !== 'object' || !('tee' in body) || typeof body.tee !== 'function') {
    return {
      primary: body,
      fallback: body,
      retryable: true,
      cancelFallback: async () => {},
    }
  }
  if (!replayStream) {
    return {
      primary: body,
      fallback: undefined,
      retryable: false,
      cancelFallback: async () => {},
    }
  }

  const [primary, fallback] = (body as ReadableStream).tee()
  return {
    primary,
    fallback,
    retryable: true,
    cancelFallback: async () => {
      try {
        await fallback.cancel()
      } catch {
      }
    },
  }
}