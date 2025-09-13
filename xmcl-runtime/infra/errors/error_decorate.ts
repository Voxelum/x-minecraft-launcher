import { isSystemError } from '~/util/error'

export function decorateError(e: unknown) {
  if (e instanceof AggregateError) {
    for (const error of e.errors) {
      decorateError(error)
    }
  }
  if (e instanceof Error) {
    if (e.name === 'Error') {
      if (isSystemError(e)) {
        if (e.syscall === 'getaddrinfo') {
          // DNS lookup issue
          e.name = 'DNSLookupError'
        } else if (e.code === 'ECONNRESET') {
          e.name = 'ConnectionResetError'
        } else if (e.code === 'ECONNREFUSED') {
          e.name = 'ConnectionRefusedError'
        } else if (e.code === 'ECONNABORTED') {
          e.name = 'ConnectionAbortedError'
        } else if (e.code === 'ETIMEDOUT') {
          e.name = 'ConnectionTimeoutError'
        } else if (e.syscall === 'watch' && e.code === 'ECANCELED') {
          e.name = 'WatchCanceledError'
        }
      }
    }
    if (e.message?.includes('This is caused by either a bug in Node.js or incorrect usage of Node.js internals')) {
      e.name = 'NodeInternalError'
    }
  }
  return e
}

export function shouldLog(e: unknown): e is Error {
  if (e instanceof Error) {
    if (e.name === 'WatchCanceledError') {
      return false
    }
    return true
  }
  return false
}
