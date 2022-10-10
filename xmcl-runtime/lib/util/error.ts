import { HTTPException } from '@xmcl/runtime-api'
import { Readable } from 'stream'
import { BodyMixin, Dispatcher, errors, Response } from 'undici'

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

export async function serializeError(e: unknown): Promise<any> {
  if (e instanceof Array) {
    if (e.length !== 1) {
      return Promise.all(e.map(serializeError))
    }
    return serializeError(e[0])
  }

  const error: any = {
  }

  const serializeUndiciError = async (e: errors.UndiciError) => {
    const options: Dispatcher.DispatchOptions = (e as any).options
    const url = new URL(options.path, options.origin)
    let body = ''
    if (e instanceof errors.ResponseStatusCodeError) {
      const b = e.body as BodyMixin
      body = await b.text()
    }
    return new HTTPException({
      type: 'httpException',
      code: (e as any).code,
      method: options.method,
      url: url.toString(),
      statusCode: e instanceof errors.ResponseStatusCodeError ? e.statusCode : 0,
      body,
    })
  }

  if (e instanceof errors.UndiciError) {
    e = await serializeUndiciError(e)
  }

  if (e instanceof Error) {
    try {
      Object.assign(error, JSON.parse(JSON.stringify(e, (key, val) => {
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
