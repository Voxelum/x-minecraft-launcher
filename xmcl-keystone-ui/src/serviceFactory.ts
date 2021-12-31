import { ServiceCallTaskListener } from '@xmcl/runtime-api';
import { ServiceKey, ServiceTemplate, StatefulService } from '@xmcl/runtime-api';

export type StateOfService<Serv> = Serv extends StatefulService<infer State>
  ? State : void

export type StateOfServiceKey<K> = K extends ServiceKey<infer Serv>
  ? StateOfService<Serv>
  : never

export interface ServiceFactory {
  getService<T>(key: ServiceKey<T>): T

  register<T, S1 extends ServiceKey<any>, D1 extends StateOfServiceKey<S1>>(serviceKey: ServiceKey<T>, template: ServiceTemplate<T>, deps: [S1], factory: (...deps: [D1]) => StateOfService<T>): void
  register<T, S1 extends ServiceKey<any>, S2 extends ServiceKey<any>, D1 extends StateOfServiceKey<S1>, D2 extends StateOfServiceKey<S2>>(serviceKey: ServiceKey<T>, template: ServiceTemplate<T>, deps: [S1, S2], factory: (...deps: [D1, D2]) => StateOfService<T>): void
  register<T, S1 extends ServiceKey<any>, S2 extends ServiceKey<any>, S3 extends ServiceKey<any>, D1 extends StateOfServiceKey<S1>, D2 extends StateOfServiceKey<S2>, D3 extends StateOfServiceKey<S3>>(serviceKey: ServiceKey<T>, template: ServiceTemplate<T>, deps: [S1, S2, S3], factory: (...deps: [D1, D2, D3]) => StateOfService<T>): void
  register<T>(serviceKey: ServiceKey<T>, template: ServiceTemplate<T>, deps: [], factory: (...deps: []) => StateOfService<T>): void
}

interface CustomFactory {
  dependencies: ServiceKey<any>[]
  template: ServiceTemplate<any>
  factory(...deps: any[]): any
}

export function createServiceFactory(options: { decoareteState?: (key: ServiceKey<any>, state: any) => any; taskListener?: ServiceCallTaskListener }): ServiceFactory {
  const cache: Record<string, any> = {}
  const stateFactories: Record<string, CustomFactory> = {}

  function createService<T>(serviceKey: ServiceKey<T>, template: ServiceTemplate<T>, state?: any): T {
    const proxy = serviceChannel.createServiceProxy(serviceKey, template, options.taskListener)
    const serv: Record<string, any> = {
      ...proxy,
      state: state ? options.decoareteState?.(serviceKey, state) : undefined,
    }
    return serv as any
  }
  const getService = <T>(key: ServiceKey<T>): T => {
    if (cache[key.toString()]) {
      return cache[key.toString()]
    }
    const stateFactory = stateFactories[key.toString()]
    if (!stateFactory) {
      throw new Error(`Unregistered service ${key}`)
    }
    const result = createService(key,
      stateFactory.template,
      stateFactory?.factory(...stateFactory.dependencies.map(d => getService(d)?.state)))

    cache[key.toString()] = result
    return result
  }
  return {
    getService,
    register(serviceKey: any, template: any, deps: any, factory: (...deps: any[]) => any) {
      stateFactories[serviceKey] = {
        dependencies: deps,
        factory,
        template,
      }
      
      getService(serviceKey)
    }
  }
}
