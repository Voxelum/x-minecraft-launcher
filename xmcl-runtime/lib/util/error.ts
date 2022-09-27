import { HTTPException } from '@xmcl/runtime-api'
import { Dispatcher, errors } from 'undici'

export interface SystemError extends Error {
  /**
   * Please see `constants.errno` in `os` module
   */
  errno: number
  code: string
  syscall?: string
  path?: string
}

export interface SystemErrorWithSyscall extends SystemError {
  syscall: string
}

export function isSystemError(e: any): e is SystemError {
  if (typeof e.errno === 'number' && typeof e.code === 'string' && e instanceof Error) {
    return true
  }
  return false
}

export function serializeError(e: unknown): any {
  if (e instanceof Array) {
    if (e.length !== 1) {
      return e.map(serializeError)
    }
    return serializeError(e[0])
  }

  const error: any = {
  }

  const serializeUndiciError = (e: errors.UndiciError) => {
    const options: Dispatcher.DispatchOptions = (e as any).options
    const url = new URL(options.path, options.origin)
    return new HTTPException({
      type: 'httpException',
      code: (e as any).code,
      method: options.method,
      url: url.toString(),
      statusCode: e instanceof errors.ResponseStatusCodeError ? e.statusCode : 0,
      body: e instanceof errors.ResponseStatusCodeError ? e.body : '',
    })
  }

  if (e instanceof errors.UndiciError) {
    e = serializeUndiciError(e)
  }

  if (e instanceof Error) {
    try {
      Object.assign(error, JSON.parse(JSON.stringify(e, (key, val) => {
        if (val instanceof errors.UndiciError) {
          return serializeUndiciError(val)
        }
        return val
      })))
    } catch (e) { }
    error.message = e.message
    error.stack = e.stack
    error.name = e.name
  } else {
    if (error) {
      error.message = error.toString()
    }
    error.exception = { type: 'GeneralException' }
  }
  return error
}
