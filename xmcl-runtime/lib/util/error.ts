import { HTTPException } from '@xmcl/runtime-api'
import { HTTPError, RequestError } from 'got'

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

  if (e instanceof HTTPError) {
    const err = e
    // eslint-disable-next-line no-ex-assign
    e = new HTTPException({
      type: 'httpException',
      code: err.code,
      url: err.response.url,
      statusCode: err.response.statusCode,
      body: err.response.body,
    })
  }

  if (e instanceof RequestError) {
    const err = e
    // eslint-disable-next-line no-ex-assign
    e = new HTTPException({
      type: 'httpException',
      code: err.code,
      url: err.options.url,
      statusCode: 0,
      body: '',
    })
  }

  if (e instanceof Error) {
    try {
      Object.assign(error, JSON.parse(JSON.stringify(e, (key, val) => {
        if (val instanceof HTTPError) {
          return new HTTPException({
            type: 'httpException',
            code: val.code,
            url: val.response.url,
            statusCode: val.response.statusCode,
            body: val.response.body,
          })
        }
        if (val instanceof RequestError) {
          return new HTTPException({
            type: 'httpException',
            code: val.code,
            url: val.options.url,
            statusCode: 0,
            body: '',
          })
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
