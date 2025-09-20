import { CancelledException, NetworkErrorCode, NetworkException } from '@xmcl/runtime-api'
import { CancelledError } from '@xmcl/task'
import { isSystemError, type SystemError } from '@xmcl/utils'
import { Dispatcher, errors } from 'undici'
export { AnyError, isSystemError } from "@xmcl/utils"
export type { SystemError } from "@xmcl/utils"

/**
 * Convert the error to plain object to be transferred to the renderer process
 */
export async function getSerializedError(e: unknown, context: object): Promise<object> {
  if ((e instanceof AggregateError) ||
    // @ts-ignore
    (e.name === 'AggregateError' && e.errors instanceof Array)) {
    e = (e as any).errors
  }
  if (e instanceof Array) {
    if (e.length !== 1) {
      return Promise.all(e.map(v => getSerializedError(v, context)))
    }
    return getSerializedError(e[0], context)
  }

  const error: any = {
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
  }
  return error
}

/**
 * Convert some common error to exception.
 * @returns The exception or `undefined` if the error is not recognized.
 */
export async function getNormalizeException(e: unknown) {
  if (e instanceof CancelledError) {
    return new CancelledException({
      type: 'cancelled',
    })
  }
  if (isSystemError(e)) {
    return getNomralizedSystemError(e)
  }
  if (e instanceof errors.UndiciError) {
    return await getNormalizedUndiciException(e)
  }
  return undefined
}

function getNomralizedSystemError(e: SystemError) {
  if ((e.errno === 'ENOTFOUND' || e.code === 'ENOTFOUND') && e.syscall === 'getaddrinfo') {
    return new NetworkException({
      type: 'networkException',
      code: NetworkErrorCode.DNS_NOTFOUND,
    })
  }
  if (e.code === 'ECONNRESET') {
    return new NetworkException({
      type: 'networkException',
      code: NetworkErrorCode.CONNECTION_RESET,
    })
  }
}

async function getNormalizedUndiciException(e: errors.UndiciError) {
  const options: Dispatcher.DispatchOptions | undefined = (e as any).options
  let body = '' as string | object
  if (e instanceof errors.ResponseStatusCodeError) {
    body = e.body || ''
  }
  let code: NetworkErrorCode | undefined
  if (e.code === 'UND_ERR_CONNECT_TIMEOUT') {
    code = NetworkErrorCode.CONNECTION_TIMED_OUT
  } else if (e.code === 'UND_ERR_SOCKET') {
    code = NetworkErrorCode.SOCKET_NOT_CONNECTED
  } else if (e.code === 'UND_ERR_HEADERS_TIMEOUT') {
    code = NetworkErrorCode.TIMED_OUT
  } else if (e.code === 'UND_ERR_BODY_TIMEOUT') {
    code = NetworkErrorCode.TIMED_OUT
  } else if (e.code === 'UND_ERR_RESPONSE_STATUS_CODE') {
    code = NetworkErrorCode.HTTP_STATUS
  }
  return code === NetworkErrorCode.HTTP_STATUS
    ? new NetworkException({
      type: 'httpException',
      code,
      method: options?.method || '',
      url: (e as any).url ?? (options ? new URL(options?.path, options.origin as any).toString() : ''),
      statusCode: e instanceof errors.ResponseStatusCodeError ? e.statusCode : 0,
      body,
    })
    : code
      ? new NetworkException({
        type: 'networkException',
        code,
      })
      : undefined
}
