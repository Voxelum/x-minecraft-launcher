export function isNullOrUndefine(object: any): object is undefined {
  return object === undefined || object === null
}
export function isNonnull<T >(object: T | undefined | null): object is T {
  return object !== undefined && object !== null
}
export function requireNumber(object: any, message: string) {
  if (typeof object !== 'number') throw new Error(message || 'Require a number!')
}
export function requireObject(object: unknown, message?: string): asserts object is object {
  if (typeof object !== 'object') throw new Error(message || 'Require a object!')
}
export function requireString(object: unknown, message?: any): asserts object is string {
  if (typeof object !== 'string') throw new Error(message || `Require a string! But get ${typeof object} ${JSON.stringify(object)}`)
}
export function requireBool(object: unknown, message?: any): asserts object is boolean {
  if (typeof object !== 'boolean') throw new Error(message || `Require a boolean! But get ${typeof object} ${JSON.stringify(object)}`)
}
export function requireNonnull(object: unknown, message?: any): asserts object {
  if (typeof object === 'undefined' || object === null) throw new Error(message || 'Require object existed!')
}
export function requireType(object: any, type: any, message: any) {
  if (!(object instanceof type)) {
    throw new Error(message || `Require object ${object} be the type ${type}`)
  }
}
export function requireTrue(object: unknown, message?: any): asserts object {
  if (!object) {
    throw new Error(message || `Require object ${object} be the truthy`)
  }
}
