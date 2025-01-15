import { Mutex } from 'async-mutex'
import { LauncherApp } from './LauncherApp'

/**
 * Just a simple mutex manager.
 */
export default class MutexManager {
  private all: Record<string, Mutex> = {}

  constructor(private app: LauncherApp) {
  }

  /**
   * Get the mutex for the resource with the path.
   * @param resourcePath The resource path
   */
  of(resourcePath: string) {
    if (!this.all[resourcePath]) {
      this.all[resourcePath] = new Mutex()
    }
    return this.all[resourcePath]
  }
}
