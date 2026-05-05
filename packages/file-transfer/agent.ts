import { Agent, interceptors, RetryHandler } from 'undici'

export function getDefaultAgent(retry?: RetryHandler.RetryOptions, defaultMaxRedirections = 5) {
  const options: Agent.Options = {
    connections: 16,
  }
  return new Agent(options).compose(
    interceptors.retry(
      retry || {
        errorCodes: [
          'UND_ERR_CONNECT_TIMEOUT',
          'UND_ERR_HEADERS_TIMEOUT',
          'UND_ERR_BODY_TIMEOUT',
          'ECONNRESET',
          'ECONNREFUSED',
          'ENOTFOUND',
          'ENETDOWN',
          'ETIMEDOUT',
          'ENETUNREACH',
          'EHOSTDOWN',
          'EHOSTUNREACH',
          'EPIPE',
          'UND_ERR_SOCKET',
        ],
        statusCodes: [567, 500, 502, 503, 504, 429],
        maxRetries: 3,
      },
    ),
    interceptors.redirect({ maxRedirections: defaultMaxRedirections }),
  )
}
