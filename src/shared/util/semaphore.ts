import { EventEmitter } from 'keyv'

export function up(semaphore: Record<string, number>, res: string | string[]) {
  const sem = res instanceof Array ? res : [res]
  for (const s of sem) {
    if (s in semaphore) {
      semaphore[s] += 1
    } else {
      semaphore[s] = 1
    }
  }
}

export function down(semaphore: Record<string, number>, res: string | string[]) {
  const sem = res instanceof Array ? res : [res]
  for (const s of sem) {
    if (s in semaphore) {
      semaphore[s] -= 1
    }
  }
}

export function isBusy(semaphore: Record<string, number>, key: string) {
  return semaphore[key] > 0
}

export class Semaphore {
  private semaphore: Record<string, number> = {}

  up(key: string) {
    up(this.semaphore, key)
  }

  down(key: string) {
    down(this.semaphore, key)
    if (this.semaphore[key] === 0) {
    }
  }

  isBusy(key: string) {
    return isBusy(this.semaphore, key)
  }

  aquire(key: string, process: () => Promise<void>) {
    const promise = this.semaphore[key] === 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
        this.emitter.once(key, resolve)
      })
    promise.then(() => {
      this.up(key)
      return process().finally(() => {
        this.down(key)
      })
    })
  }
}
