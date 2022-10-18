import { InjectionKey } from 'vue'
import { ServiceKey, StatefulService } from '@xmcl/runtime-api'
import { injection } from '../util/inject'

export type StateOfService<Serv> = Serv extends StatefulService<infer State>
  ? State : undefined

export interface ServiceFactory {
  getService<T>(key: ServiceKey<T>): T

  register<T>(serviceKey: ServiceKey<T>, factory: () => StateOfService<T>): void
}

export const kServiceFactory: InjectionKey<ServiceFactory> = Symbol('SERVICES_KEY')

export function useService<T = unknown>(name: ServiceKey<T>): T {
  return injection(kServiceFactory).getService(name)
}

export function useServiceOnly<T = unknown, Keys extends keyof T = keyof void>(name: ServiceKey<T>, ...keys: Keys[]): Pick<T, Keys> {
  const seriv = injection(kServiceFactory).getService(name)
  const service = {} as any
  for (const key of keys) {
    service[key] = seriv[key]
  }
  return service
}
