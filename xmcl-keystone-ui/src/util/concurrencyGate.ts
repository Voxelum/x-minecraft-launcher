export interface ConcurrencyGate {
  acquire(): Promise<(() => void) | undefined>
  clear(): void
}

export function createConcurrencyGate(limit: number): ConcurrencyGate {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Concurrency limit must be a positive integer')
  }

  let active = 0
  const waiting: Array<(release: (() => void) | undefined) => void> = []

  function createRelease() {
    let released = false
    return () => {
      if (released) return
      released = true

      const next = waiting.shift()
      if (next) {
        next(createRelease())
      } else {
        active--
      }
    }
  }

  return {
    acquire() {
      if (active < limit) {
        active++
        return Promise.resolve(createRelease())
      }
      return new Promise(resolve => waiting.push(resolve))
    },
    clear() {
      for (const resolve of waiting.splice(0)) {
        resolve(undefined)
      }
    },
  }
}
