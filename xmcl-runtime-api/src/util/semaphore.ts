import { ServiceKey } from '../services/Service'

export const LockKey = {
  versions: 'versions',
  libraries: 'libraries',
  assets: 'assets',
  version: (v: string) => `versions/${v}`,
  instance: (p: string) => `instances/${p}`,
}

export function resolveLocks(lock: string): string[] {
  const [type, body] = lock.indexOf(':') === -1 ? ['', lock] : lock.split(':')
  const locks = []
  for (let pos = body.indexOf('/'); pos !== -1; pos = body.indexOf('/', pos + 1)) {
    locks.push(body.substring(0, pos))
  }
  locks.push(body)
  return type ? locks.map(v => `${type}:${v}`) : locks
}

export type ParamSerializer = (...params: any[]) => string | undefined

export function getServiceSemaphoreKey<T>(key: ServiceKey<T>, method: keyof T, params?: string) {
  return params ? `${key}.${method as string}(${params})` : `${key}.${method as string}()`
}
