export interface ExceptionBase {
  type: string
}

export type SelfContain<T> = T

export class Exception<T extends ExceptionBase> extends Error {
  constructor(readonly exception: T, message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = Object.getPrototypeOf(this).constructor.name
  }
}

export function isException<T>(clazz: { new(...args: any[]): T }, error: unknown): error is T {
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === clazz.name && 'exception' in error && typeof ((error as any).exception) === 'object') {
    return true
  }
  return false
}

export interface InstanceNotFoundException extends ExceptionBase {
  type: 'instanceNotFound'
  instancePath: string
}

export type NetworkExceptions = {
  type: 'httpException'
  code: NetworkErrorCode.HTTP_STATUS
  method: string
  url: string
  statusCode: number
  body: any
} | {
  type: 'networkException'
  code: string | number
}

export const enum NetworkErrorCode {
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',
  INTERNET_DISCONNECTED = 'INTERNET_DISCONNECTED',
  NETWORK_CHANGED = 'NETWORK_CHANGED',
  PROXY_CONNECTION_FAILED = 'PROXY_CONNECTION_FAILED',
  CONNECTION_RESET = 'CONNECTION_RESET',
  CONNECTION_TIMED_OUT = 'CONNECTION_TIMED_OUT',
  TIMED_OUT = 'TIMED_OUT',
  DNS_NOTFOUND = 'NAME_NOT_RESOLVED',
  SOCKET_NOT_CONNECTED = 'SOCKET_NOT_CONNECTED',
  // all above user can retry
  HTTP_STATUS = 'HTTP_STATUS',
}

export class NetworkException extends Exception<NetworkExceptions> {
  name = 'NetworkException'
}

export function isFileNoFound(e: unknown) {
  return typeof e === 'object' && e !== null && ('code' in e && (e as any).code === 'ENOENT')
}
