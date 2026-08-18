export type ServiceFailureCategory =
  | 'cancelled'
  | 'download'
  | 'disk-full'
  | 'permission'
  | 'postprocess'
  | 'version-parse'
  | 'unknown'

const networkCodes = new Set([
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

const networkNames = new Set([
  'DownloadAggregateError',
  'InstallFileDownloadError',
  'NetworkException',
  'ConnectTimeoutError',
  'BodyTimeoutError',
  'HeadersTimeoutError',
  'SocketError',
  'DNSNotFoundError',
])

export function getServiceFailureCategory(error: unknown): ServiceFailureCategory {
  if (Array.isArray(error)) return firstKnown(error)
  if (!error || typeof error !== 'object') return 'unknown'
  const value = error as Record<string, unknown>
  if (value.code === 'ENOSPC') return 'disk-full'
  if (value.code === 'EPERM' || value.code === 'EACCES' || value.code === 'EROFS') return 'permission'
  if (value.name === 'AbortError' || value.code === 'ABORT_ERR') return 'cancelled'
  if (typeof value.code === 'string' && networkCodes.has(value.code)) return 'download'
  if (typeof value.name === 'string' && networkNames.has(value.name)) return 'download'
  if (value.name === 'ProcessExitError') return 'postprocess'
  if (typeof value.name === 'string' && ['MissingVersionJson', 'CorruptedVersionJson', 'BadVersionJson'].includes(value.name)) return 'version-parse'
  if (Array.isArray(value.errors)) {
    const nested = firstKnown(value.errors)
    if (nested !== 'unknown') return nested
  }
  return value.cause ? getServiceFailureCategory(value.cause) : 'unknown'
}

function firstKnown(errors: unknown[]): ServiceFailureCategory {
  for (const error of errors) {
    const category = getServiceFailureCategory(error)
    if (category !== 'unknown') return category
  }
  return 'unknown'
}