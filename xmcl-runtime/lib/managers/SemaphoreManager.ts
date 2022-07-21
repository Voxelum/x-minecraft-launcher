import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { ReadWriteLock } from '../util/mutex'

export default class SemaphoreManager extends Manager {
  private locks: Record<string, ReadWriteLock> = {}

  private semaphore: Record<string, number> = {}

  constructor(app: LauncherApp) {
    super(app)
    app.handle('semaphore', () => {
      return this.semaphore
    })
    app.handle('semaphoreAbort', (_, key) => {
      this.log(`Force release the semaphore: ${key}`)
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
    this.app.broadcast('release', key)
  }
}
