
export type Exceptions = InstanceNotFoundException | GeneralException
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

export class GeneralException extends Exception<{
  type: 'general' | 'fsError'
  error: Error
}> { }

export function isException<T>(clazz: { new(...args: any[]): T }, error: unknown): error is T {
  if (error && typeof error === 'object' && 'name' in error && (error as any).name === clazz.name) {
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
