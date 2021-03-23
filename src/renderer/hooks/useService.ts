import { ServiceProxy, SERVICES_KEY } from '/@/constant'
import { inject } from '@vue/composition-api'
import { ServiceKey } from '/@shared/services/Service'

export function useServices(): ServiceProxy {
  const seriv = inject(SERVICES_KEY)
  if (!seriv) throw new Error('Cannot find Services. Maybe it is not loaded?')
  return seriv
}

export function useService<T = unknown>(name: ServiceKey<T>): T {
  return useServices()(name)
}

export function useServiceOnly<T = unknown, Keys extends keyof T = keyof void>(name: ServiceKey<T>, ...keys: Keys[]): Pick<T, Keys> {
  const seriv = useServices()(name)
  const service = {} as any
  for (const key of keys) {
    service[key] = seriv[key]
  }
  return service
}
