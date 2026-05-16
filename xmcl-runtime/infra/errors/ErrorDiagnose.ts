import { LauncherApp } from '~/app'
import { kSettings } from '~/settings'
import { isSystemError } from '@xmcl/utils'

export class ErrorDiagnose {
  #foundDiskFullError: boolean = false
  #sqlDiskIOError: boolean = false
  #noPermissionCount = 0
  #databaseLockedCount = 0

  constructor(private app: LauncherApp) {}

  async #markNoSpace() {
    const settings = await this.app.registry.get(kSettings)
    settings.diskFullErrorSet(true)
  }

  get sqlDiskIOError() {
    return this.#sqlDiskIOError
  }

  /**
   * @returns `true` to ignore error
   */
  processError(e: Error): boolean {
    if (e.name === 'SQLite3Error') {
      // The driver already auto-reopens the handle on these transient
      // failures (see SqliteWASMDriver). Suppress them from telemetry so we
      // don't get the per-user storm reported in issue #1429.
      if ((e as any).isDisposed) {
        return true
      }
      if (
        e.message === 'Database already closed' ||
        e.message === 'unable to open database file'
      ) {
        return true
      }
      if (e.message.startsWith('disk I/O error')) {
        this.#sqlDiskIOError = true
      }
      // Ignore sqlite error if the disk is full
      return this.#foundDiskFullError
    }
    if (isSystemError(e) && e.code === 'ENOSPC') {
      if (!this.#foundDiskFullError) {
        return true
      }
      this.#foundDiskFullError = true
      this.#markNoSpace()
    }
    if (isSystemError(e) && e.code === 'EPERM') {
      this.#noPermissionCount++
      return this.#noPermissionCount > 3
    }
    if (e.name === 'SQLite3Error' && e.message === 'database is locked') {
      this.#databaseLockedCount++
      return this.#databaseLockedCount > 3
    }
    if (e.name === 'WatchCanceledError') {
      return true
    }
    if (e instanceof TypeError && e.message.startsWith('fetch failed')) {
      return true
    }
    if (e.name === 'ClientAuthError' && e.message.includes('Network request failed')) {
      return true
    }
    return false
  }
}
