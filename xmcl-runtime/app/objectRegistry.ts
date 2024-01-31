import { PromiseSignal, createPromiseSignal } from '@xmcl/runtime-api'
import { AnyError } from '~/util/error'

/**
 * The helper class to hold type to object map
 */
export class ObjectFactory {
  private signals: Map<Constructor | InjectionKey<any>, PromiseSignal<any> & { handled: boolean }> = new Map()

  register<T>(type: Constructor<T> | InjectionKey<T>, value: T): this {
    if (this.signals.has(type)) {
      this.signals.get(type)!.resolve(value)
    } else {
      const signal = createPromiseSignal<T>()
      signal.resolve(value)
      this.signals.set(type, { ...signal, handled: true })
    }
    return this
  }

  has<T>(Type: Constructor<T> | InjectionKey<T>): boolean {
    return this.signals.has(Type)
  }

  getIfPresent<T>(Type: Constructor<T> | InjectionKey<T>): Promise<T | undefined> {
    if (this.signals.has(Type)) {
      return this.signals.get(Type)!.promise
    }
    return Promise.resolve(undefined)
  }

  /**
   * Get the type or key registered object. This won't trigger the creation of the object.
   */
  get<T>(Type: Constructor<T> | InjectionKey<T>): Promise<T> {
    if (this.signals.has(Type)) {
      return this.signals.get(Type)!.promise
    }
    const signal = createPromiseSignal<T>()
    this.signals.set(Type, { ...signal, handled: false })
    return signal.promise
  }

  async getOrCreate<T>(Type: Constructor<T> | InjectionKey<T>): Promise<T> {
    let signal: PromiseSignal<any> & {
      handled: boolean
    } | undefined
    if (this.signals.has(Type)) {
      signal = this.signals.get(Type)!
      if (signal.handled) {
        return signal.promise
      } else if (typeof Type === 'symbol') {
        return signal.promise
      }
      signal.handled = true
    } else {
      signal = { ...createPromiseSignal<T>(), handled: typeof Type !== 'symbol' }
      this.signals.set(Type, signal)
      if (typeof Type === 'symbol') {
        return signal.promise
      }
    }
    try {
      const types = Reflect.get(Type, kParams)
      const params: any[] = new Array(types?.length ?? 0)
      if (types) {
        for (let i = 0; i < types.length; i++) {
          const type = types[i]
          if (type) {
            params[i] = await this.getOrCreate(type)
          } else {
            throw new AnyError('ObjectRegistryError', `Fail to get [${i}] param type for ${typeof Type === 'symbol' ? Type.toString() : (Type as Function).name} since it's not registered`)
          }
        }
      }

      const service = new (Type as any)(...params)
      signal.resolve(service)
      return service
    } catch (e) {
      signal.reject(e)
      throw e
    }
  }
}

type Constructor<T = any> = (new (...args: any[]) => T) | (abstract new (...args: any[]) => T)
type ConstructorParameter<T, X> = T extends (new (...args: infer P) => X) ? P : never
const kParams = Symbol('params')

export interface InjectionKey<T> extends Symbol { }

export function Inject<T, V extends Constructor<T> | InjectionKey<T>>(con: V/* , ...args: V extends Constructor<T> ? ConstructorParameter<V, T> : never[] */) {
  return (target: any, _key: any, index: number) => {
    if (Reflect.has(target, kParams)) {
      Reflect.get(target, kParams)[index] = con
    } else {
      const arr: any[] = []
      Reflect.set(target, kParams, arr)
      arr[index] = con
    }
  }
}
