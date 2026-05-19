import { isSystemError } from '@xmcl/utils'

/**
 * Assign a more descriptive name to a vanilla `Error` without crashing when
 * the underlying object has a non-writable `name` descriptor — e.g. errors
 * crossing a `Proxy` whose `set` trap rejects `name`, or wrapped third-party
 * errors that define `name` as a getter-only on the prototype.
 *
 * Naively doing ``e.name = newName`` throws ``TypeError: Cannot set property
 * name of <obj> which has only a getter`` and the thrown TypeError then
 * surfaces as its own telemetry exception (problemId
 * "TypeError at decorateError"). Use ``defineProperty`` so it lands as an
 * own data property even when the prototype shape forbids the assignment.
 */
function setErrorName(e: Error, name: string): void {
  try {
    e.name = name
  } catch {
    try {
      Object.defineProperty(e, 'name', { value: name, configurable: true, writable: true, enumerable: false })
    } catch {
      // Object is frozen / sealed — accept it and move on; the original name
      // stays. Better than crashing the error pipeline.
    }
  }
}

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
          setErrorName(e, 'DNSLookupError')
        } else if (e.code === 'ECONNRESET') {
          setErrorName(e, 'ConnectionResetError')
        } else if (e.code === 'ECONNREFUSED') {
          setErrorName(e, 'ConnectionRefusedError')
        } else if (e.code === 'ECONNABORTED') {
          setErrorName(e, 'ConnectionAbortedError')
        } else if (e.code === 'ETIMEDOUT') {
          setErrorName(e, 'ConnectionTimeoutError')
        } else if (e.syscall === 'watch' && e.code === 'ECANCELED') {
          setErrorName(e, 'WatchCanceledError')
        }
      }
    }
    if (e.message?.includes('This is caused by either a bug in Node.js or incorrect usage of Node.js internals')) {
      setErrorName(e, 'NodeInternalError')
    }
  }
  return e
}
