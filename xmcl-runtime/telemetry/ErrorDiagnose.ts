import { LauncherApp } from '~/app'
import { kSettings } from '~/settings'
import { isSystemError } from '~/util/error'

export class ErrorDiagnose {
  #foundDiskFullError: boolean = false
  #sqlDiskIOError: boolean = false

  constructor(private app: LauncherApp) {
  }

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
    if (e.name === 'SQLite3Error' && e.message === 'disk I/O error') {
      // Ignore disk I/O error if the disk is full
      this.#sqlDiskIOError = true
      return this.#foundDiskFullError
    }
    if (e.name === 'Error' && isSystemError(e) && e.code === 'ENOSPC') {
      if (!this.#foundDiskFullError) {
        return true
      }
      this.#foundDiskFullError = true
      this.#markNoSpace()
    }

    return false
  }
}