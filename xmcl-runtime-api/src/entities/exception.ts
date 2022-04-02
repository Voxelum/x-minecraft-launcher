
export type Exceptions = InstanceNotFoundException | GeneralException
export interface ExceptionBase {
  type: string
}

export class Exception<T extends ExceptionBase> extends Error implements ExceptionBase {
  type: string
  exceptionClass: string

  constructor(readonly exception: T, message?: string) {
    super(message)
    this.type = exception.type
    this.exceptionClass = Object.getPrototypeOf(this).constructor.name
    Object.assign(this, exception)
  }
}

export class GeneralException extends Exception<{
  type: 'general' | 'fsError'
  error: Error
}> { }

export function isException<T>(clazz: { new(): T }, error: unknown): error is T {
  if (error && typeof error === 'object' && 'exceptionClass' in error && (error as any).exceptionClass === clazz.name) {
    return true
  }
  return false
}

export interface InstanceNotFoundException extends ExceptionBase {
  type: 'instanceNotFound'
  instancePath: string
}

export function isFileNoFound(e: unknown) {
  return typeof e === 'object' && e !== null && ('code' in e && (e as any).code === 'ENOENT')
}

export function wrapError(e: Error, exception: Exceptions) {
  Object.assign(e, exception)
  return e
}
