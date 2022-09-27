
export interface ExceptionBase {
  type: string
}

export type SelfContain<T> = T

export class Exception<T extends ExceptionBase> extends Error {
  constructor(readonly exception: T, message?: string) {
    super(message)
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

export interface HTTPExceptions extends ExceptionBase {
  type: 'httpException'
  method: string
  code: string
  url: string
  statusCode: number
  body: any
}

export class HTTPException extends Exception<HTTPExceptions> {}

export function isFileNoFound(e: unknown) {
  return typeof e === 'object' && e !== null && ('code' in e && (e as any).code === 'ENOENT')
}
