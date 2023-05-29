import { ServiceKey } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { injection } from '../util/inject'

export interface ServiceFactory {
  getService<T>(key: ServiceKey<T>): T
}

export class ServiceFactoryImpl implements ServiceFactory {
  private cache: Record<string, any | undefined> = {}

  constructor() { }

  private createProxy<T>(serviceKey: ServiceKey<T>) {
    const channel = serviceChannels.open(serviceKey)

    const service: Record<string, any> = new Proxy({
      on: channel.on,
      once: channel.once,
      removeListener: channel.removeListener,
    } as any, {
      get(o, key, r) {
        if (key in o) return o[key]
        const f = (...payload: any[]) => channel.call(key as any, ...(payload as any))
        o[key] = f
        return f
      },
    })
    return service
  }

  getService<T>(key: ServiceKey<T>): T {
    const cached = this.cache[key.toString()]
    if (!cached) {
      const proxy = this.createProxy(key)
      this.cache[key.toString()] = proxy
      return proxy as T
    }
    return cached
  }
}

export function useServiceFactory() {
  return new ServiceFactoryImpl()
}

export const kServiceFactory: InjectionKey<ServiceFactory> = Symbol('SERVICES_KEY')

export function useService<T = unknown>(name: ServiceKey<T>): T {
  return injection(kServiceFactory).getService(name)
}
