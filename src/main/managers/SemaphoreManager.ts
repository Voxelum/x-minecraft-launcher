import { Manager } from '.'
import { ReadWriteLock } from '../util/mutex'

export class SemaphoreManager extends Manager {
  private locks: Record<string, ReadWriteLock> = {}

  private semaphore: Record<string, number> = {}

  getLock(resourcePath: string) {
    if (!this.locks[resourcePath]) {
      this.locks[resourcePath] = new ReadWriteLock((delta) => {
        if (delta > 0) {
          this.aquire(resourcePath)
        } else {
          this.release(resourcePath)
        }
      })
    }
    return this.locks[resourcePath]
  }

  /**
   * Aquire and boradcast the key is in used.
   * @param key The key or keys to aquire
   */
  aquire(key: string) {
    this.semaphore[key] += 1
    this.app.broadcast('aquire', key)
  }

  /**
   * Release and boradcast the key is not used.
   * @param key The key or keys to release
   */
  release(key: string) {
    this.semaphore[key] -= 1
    this.app.broadcast('release', key)
  }

  setup() {
    this.app.handle('semaphore', () => {
      return this.semaphore
    })
  }
}
