/**
 * The helper class to hold type to object map
 */
export class ObjectRegistry {
  private injections: Map<Constructor, any> = new Map()

  register<T>(type: Constructor<T>, value: T): this {
    this.injections.set(type, value)
    return this
  }

  getObject<T>(type: Constructor<T>): T | undefined {
    return this.injections.get(type)
  }
}

type Constructor<T = any> = {
  new(...args: any[]): T
}
