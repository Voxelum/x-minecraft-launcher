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

export class AnyError extends Error {
  constructor(name: string, message?: string, options?: ErrorOptions, properties?: any) {
    super(message, options)
    this.name = name
    if (properties) {
      Object.assign(this, properties)
    }
  }

  static make(name: string) {
    return class extends AnyError {
      constructor(message?: string, options?: ErrorOptions) {
        super(name, message, options)
      }
    }
  }
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
  if ((e instanceof AggregateError) ||
    // @ts-ignore
    (e.name === 'AggregateError' && e.errors instanceof Array)) {
    e = (e as any).errors
  }
  if (e instanceof Array) {
    if (e.length !== 1) {
      return Promise.all(e.map(serializeError))
    }
    return serializeError(e[0])
  }

  const error: any = {
  }

  const serializeUndiciError = async (e: errors.UndiciError) => {
    const options: Dispatcher.DispatchOptions | undefined = (e as any).options
    let body = '' as string | object
    if (e instanceof errors.ResponseStatusCodeError) {
      body = e.body || ''
    }
    return new HTTPException({
      type: 'httpException',
      code: e.code,
      method: options?.method || '',
      url: (e as any).url ?? (options ? new URL(options?.path, options.origin as any).toString() : ''),
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
