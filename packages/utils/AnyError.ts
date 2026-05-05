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
