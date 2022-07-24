import { nextTick } from 'process'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { ReadWriteLock } from '../util/mutex'

export default class SemaphoreManager extends Manager {
  private locks: Record<string, ReadWriteLock> = {}

  private semaphore: Record<string, number> = {}
  private semaphoreWaiter: Record<string, Array<() => void>> = {}
  private logger = this.app.logManager.getLogger('SemaphoreManager')

  constructor(app: LauncherApp) {
    super(app)
    app.handle('semaphore', () => {
      return this.semaphore
    })
    app.handle('semaphoreAbort', (_, key) => {
      this.logger.log(`Force release the semaphore: ${key}`)
      this.release(key)
    })
  }

  getLock(resourcePath: string) {
    if (!this.locks[resourcePath]) {
      this.locks[resourcePath] = new ReadWriteLock((delta) => {
        if (delta > 0) {
          this.acquire(resourcePath)
        } else {
          this.release(resourcePath)
        }
      })
    }
    return this.locks[resourcePath]
  }

  /**
   * Acquire and broadcast the key is in used.
   * @param key The key or keys to acquire
   */
  acquire(key: string) {
    if (key in this.semaphore) {
      this.semaphore[key] += 1
    } else {
      this.semaphore[key] = 1
    }
    this.app.broadcast('acquire', key)
  }

  wait(key: string) {
    if (this.semaphore[key] === 0) return Promise.resolve()
    return new Promise<void>((resolve) => {
      if (!this.semaphoreWaiter[key]) {
        this.semaphoreWaiter[key] = []
      }
      this.semaphoreWaiter[key].push(resolve)
    })
  }

  /**
   * Release and broadcast the key is not used.
   * @param key The key or keys to release
   */
  release(key: string) {
    if (key in this.semaphore) {
      this.semaphore[key] -= 1
    } else {
      this.semaphore[key] = 0
    }
    if (this.semaphore[key] === 0) {
      nextTick(() => {
        if (this.semaphore[key] === 0) {
          const all = this.semaphoreWaiter[key]
          if (all) {
            for (const w of all) w()
            this.semaphoreWaiter[key] = []
          }
        }
      })
    }
    this.app.broadcast('release', key)
  }
}
