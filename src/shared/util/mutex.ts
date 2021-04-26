export const versionsLock = 'versions'
export const librariesLock = 'libraries'
export const assetsLock = 'assets'
export const versionLockOf = (v: string) => `versions/${v}`

export const read = (lock: string) => `read:${lock}`
export const write = (lock: string) => `write:${lock}`

export function resolveLocks(lock: string): string[] {
  const [type, body] = lock.indexOf(':') === -1 ? ['', lock] : lock.split(':')
  const locks = []
  for (let pos = body.indexOf('/'); pos !== -1; pos = body.indexOf('/', pos + 1)) {
    locks.push(body.substring(0, pos))
  }
  locks.push(body)
  return type ? locks.map(v => `${type}:${v}`) : locks
}
