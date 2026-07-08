import { CancelledException, NetworkErrorCode, NetworkException } from '@xmcl/runtime-api'
import { isSystemError, type SystemError } from '@xmcl/utils'
import { Dispatcher, errors } from 'undici'
export { AnyError, isSystemError } from "@xmcl/utils"
export type { SystemError } from "@xmcl/utils"

/**
 * Convert some common error to exception.
 * @returns The exception or `undefined` if the error is not recognized.
 */
export async function getNormalizeException(e: unknown) {
  if (e instanceof Error && e.name === 'AbortError') {
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
  if (e instanceof errors.ResponseError) {
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
      statusCode: e instanceof errors.ResponseError ? e.statusCode : 0,
      body,
    })
    : code
      ? new NetworkException({
        type: 'networkException',
        code,
      })
      : undefined
}
