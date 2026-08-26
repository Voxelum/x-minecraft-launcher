export class AnyError extends Error {
  constructor(name: string, message?: string, options?: ErrorOptions, properties?: any) {
    super(message, options)
    this.name = name
    if (properties) {
      Object.assign(this, properties)
    }
  }
}

export function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    if (typeof value.description === 'string' && value.description) return value.description
    if (typeof value.errorMessage === 'string' && value.errorMessage) return value.errorMessage
    if (typeof value.message === 'string' && value.message) return value.message
    if (typeof value.body === 'string') {
      try {
        const body = JSON.parse(value.body) as Record<string, unknown>
        if (typeof body.description === 'string' && body.description) return body.description
        if (typeof body.error === 'string' && body.error) return body.error
      } catch { }
    }
  }
  return String(error)
}

const downloadErrorNames = new Set([
  'DownloadAggregateError',
  'InstallFileDownloadError',
  'ConnectTimeoutError',
  'BodyTimeoutError',
  'HeadersTimeoutError',
  'SocketError',
  'DNSNotFoundError',
  'NetworkException',
])

const downloadErrorCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
])

export function isDownloadError(error: unknown): boolean {
  if (Array.isArray(error)) return error.some(isDownloadError)
  if (!error || typeof error !== 'object') return false
  const value = error as Record<string, unknown>
  if (typeof value.name === 'string' && downloadErrorNames.has(value.name)) return true
  if (typeof value.code === 'string' && downloadErrorCodes.has(value.code)) return true
  if (typeof value.message === 'string' && value.message.includes('fetch failed')) return true
  if (Array.isArray(value.errors) && value.errors.some(isDownloadError)) return true
  return isDownloadError(value.cause)
}
