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
    // Issue #1442: 404 from /minecraft/profile just means the user's MS
    // account doesn't own Minecraft. The login flow now wraps it in a
    // UserException, but suppress it here too in case any future caller
    // forgets and bubbles the raw error through logEmitter('failure').
    if (e.name === 'ProfileNotFoundError') {
      return true
    }
    // Issue #1446: Node WHATWG streams throw ERR_INVALID_STATE
    // "Controller is already closed" when a ReadableStream we wrap around
    // an aborted/closed fetch tries to enqueue a late chunk. This is
    // benign — the consumer is already gone. The renderer/keystone
    // protocol handlers now guard against it, but suppress here as the
    // last line of defense (minified async stacks make the call site
    // unidentifiable anyway).
    if (e instanceof TypeError && (e as any).code === 'ERR_INVALID_STATE') {
      return true
    }
    // ---- Expected user-state failures (Runbook section 0: should be ----
    // `Exception` rather than `Error`). They tell us about user/environment
    // state, not a defect, so they must not pollute trackException.

    // User closed the browser / window before completing OAuth, or the auth
    // server simply never returned a code in time.
    if (e.name === 'AuthCodeTimeoutError') {
      return true
    }
    // Friends panel polled while the user is signed out or the cached token
    // already expired. Expected, not a bug.
    if (e.name === 'UserAuthenticationError') {
      return true
    }
    // Mojang Friends API rate-limited us (HTTP 429). The service already
    // backs off via the cache cooldown; reporting every 429 only generates
    // a per-user storm of identical exceptions.
    if (e.name === 'MojangFriendsError' && /\b429\b/.test(e.message)) {
      return true
    }
    // Silent token refresh is *expected* to fail when the refresh token is
    // expired / revoked — the launcher then falls back to an interactive
    // login. The user sees the right thing; telemetry should not.
    if (e.name === 'MicrosoftOAuthSlientFailed') {
      return true
    }
    return false
  }
}
