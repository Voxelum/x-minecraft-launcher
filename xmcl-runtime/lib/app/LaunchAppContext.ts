
export type Constructor<T = any> = {
  new(...args: any[]): T
}

export class LaunchAppContext {
  private injections: Map<Constructor, any> = new Map()

  register<T>(type: Constructor<T>, value: T): this {
    this.injections.set(type, value)
    return this
  }

  getObject<T>(type: Constructor<T>): T | undefined {
    return this.injections.get(type)
  }
}
