import { ServiceFactory } from '../serviceFactory'
import { SERVICES_KEY } from '../serviceProxy'
import { injection } from '../util/inject'
import { ServiceKey } from '@xmcl/runtime-api'

export function useServices(): ServiceFactory {
  const seriv = injection(SERVICES_KEY)
  return seriv
}

export function useService<T = unknown>(name: ServiceKey<T>): T {
  return useServices().getService(name)
}

export function useServiceOnly<T = unknown, Keys extends keyof T = keyof void>(name: ServiceKey<T>, ...keys: Keys[]): Pick<T, Keys> {
  const seriv = useServices().getService(name)
  const service = {} as any
  for (const key of keys) {
    service[key] = seriv[key]
  }
  return service
}
