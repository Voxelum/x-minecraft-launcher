/**
 * The helper class to hold type to object map
 */
export class ObjectFactory {
  private injections: Map<Constructor | InjectionKey<any>, any> = new Map()

  register<T>(type: Constructor<T> | InjectionKey<T>, value: T): this {
    this.injections.set(type, value)
    return this
  }

  has<T>(Type: Constructor<T> | InjectionKey<T>): boolean {
    return this.injections.has(Type)
  }

  get<T>(Type: Constructor<T> | InjectionKey<T>): T | undefined {
    if (this.injections.has(Type)) {
      return this.injections.get(Type)
    }
    if (typeof Type === 'symbol') {
      return undefined
    }
    const types = Reflect.get(Type, kParams)
    const params: any[] = new Array(types?.length ?? 0)

    let failed = false
    if (types) {
      for (let i = 0; i < types.length; i++) {
        const type = types[i]
        if (type) {
          if (this.injections.has(type)) {
            // inject object
            params[i] = this.injections.get(type)
          } else {
            const newCreated = this.get(type)
            if (newCreated) {
              params[i] = newCreated
            } else {
              failed = true
            }
          }
        }
      }
    }

    if (failed) {
      return undefined
    }

    const service = new (Type as any)(...params)
    this.register(Type, service)
    return service
  }
}

type Constructor<T = any> = (new (...args: any[]) => T) | (abstract new (...args: any[]) => T)
type ConstructorParameter<T, X> = T extends (new (...args: infer P) => X) ? P : never
const kParams = Symbol('params')

export interface InjectionKey<T> extends Symbol { }
export interface InjectionFactoryKey<T, Args> extends Symbol { }

export function Inject<T, V extends Constructor<T> | InjectionKey<T>>(con: V/* , ...args: V extends Constructor<T> ? ConstructorParameter<V, T> : never[] */) {
  return (target: any, key: string, index: number) => {
    if (Reflect.has(target, kParams)) {
      Reflect.get(target, kParams)[index] = con
    } else {
      const arr: any[] = []
      Reflect.set(target, kParams, arr)
      arr[index] = con
    }
  }
}
