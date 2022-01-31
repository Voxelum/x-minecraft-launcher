import { ServiceKey } from '@xmcl/runtime-api'
import { injection } from '../util/inject'
import { SERVICES_KEY } from '../vuexServiceProxy'

export function useService<T = unknown>(name: ServiceKey<T>): T {
  return injection(SERVICES_KEY).getService(name)
}

export function useServiceOnly<T = unknown, Keys extends keyof T = keyof void>(name: ServiceKey<T>, ...keys: Keys[]): Pick<T, Keys> {
  const seriv = injection(SERVICES_KEY).getService(name)
  const service = {} as any
  for (const key of keys) {
    service[key] = seriv[key]
  }
  return service
}
