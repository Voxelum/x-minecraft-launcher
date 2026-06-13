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
    // Modpack install lock file (.install-profile) was deleted or the
    // installer never wrote one (e.g. user wiped the instance dir
    // mid-install). The user-facing flow already shows a "no pending
    // install" notice; suppress the per-file ENOENT spam (91 ev/12
    // users in 0.56.4). Also covers EPERM/EBUSY on the same path —
    // OneDrive / antivirus holding the lock file open mid-install
    // (0.56.7 telemetry: 38 users, mostly Windows users with
    // `Users\<name>\.minecraftx\instances\<inst>\.install-profile`).
    // Must come BEFORE the generic EPERM throttle below — otherwise
    // the first 3 are still reported, which is exactly what we want
    // to suppress entirely for this well-understood failure mode.
    if ((e as any).name === 'InstallInstanceFilesError' && isSystemError(e) &&
        (e.code === 'ENOENT' || e.code === 'EPERM' || e.code === 'EBUSY') &&
        /\.install-profile/.test(e.message)) {
      return true
    }
    // chokidar's FSWatcher in `InstanceInstallService#watchInstanceInstall`
    // now retags its 'error' events as `InstanceInstallWatcherError`
    // before swallowing them — but old releases bubbled raw
    // `Error: EPERM stat '...\.install-profile'` into telemetry where
    // they were indistinguishable from every other generic Error.
    // Suppress the typed form here, and also suppress the raw form
    // when the message clearly points at `.install-profile` so we
    // close the gap for users still on those releases.
    if ((e as any).name === 'InstanceInstallWatcherError') {
      return true
    }
    // Instance duplicate: per-file ENOENT used to bubble up as one
    // unhandledRejection per file (uncaught_error → trackException).
    // The per-file copy paths now swallow ENOENT/ENOTDIR and emit ONE
    // aggregated `InstanceDuplicatePartialError` for the remainder;
    // suppress the aggregated form here so a partial clone with a few
    // genuine non-ENOENT failures doesn't keep firing per session.
    // The error.failures array is still attached for the next pass to
    // analyse via local logs.
    if ((e as any).name === 'InstanceDuplicatePartialError') {
      return true
    }
    if (e.name === 'Error' && isSystemError(e) &&
        (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'EACCES' || e.code === 'ENOENT') &&
        /\.install-profile/.test(e.message)) {
      return true
    }
    if (isSystemError(e) && e.code === 'EPERM') {
      this.#noPermissionCount++
      return this.#noPermissionCount > 3
    }
    // Same per-user storm dynamic as EPERM but different OS error
    // classes: file held by Explorer/AV (EBUSY), file already exists
    // for a symlink target (EEXIST), parent path renamed mid-op
    // (EINVAL on Windows rename), filesystem unmounted / read-only
    // (EROFS / EIO), generic "UNKNOWN" wrapper Node uses for
    // GetFileInformationByHandle failures on Windows. None of these
    // are defects in the launcher — they're user/AV/filesystem state
    // we cannot work around — but a single failure can fire dozens of
    // times during a copy/realpath walk. Bucket them the same way.
    if (isSystemError(e) && (e.code === 'EBUSY' || e.code === 'EEXIST' ||
        e.code === 'EINVAL' || e.code === 'EROFS' || e.code === 'EIO' ||
        e.code === 'UNKNOWN')) {
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
    // MSAL surfaces a few more strictly user/network-state failures
    // that are not defects:
    //   - `device_code_expired`: user opened the device-code dialog
    //     and never finished authenticating within MSAL's 15-min
    //     window. Identical to AuthCodeTimeoutError, just from the
    //     device-code flow rather than the redirect flow.
    //   - `endpoints_resolution_error`: MSAL could not reach
    //     login.microsoftonline.com (DNS / proxy / regional outage).
    //     Same shape as the existing `Network request failed`
    //     suppression — just a different MSAL error code.
    //   - `interaction_required` / `user_cancelled`: silent flows
    //     that need a UI re-prompt; the launcher already triggers
    //     one, telemetry would only see the dead-end attempt.
    if (e.name === 'ClientAuthError' && /\b(device_code_expired|endpoints_resolution_error|interaction_required|user_cancelled)\b/.test(e.message)) {
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
    // Network/HTTP fetch was aborted by the caller (component unmount,
    // user navigation, app shutdown). Surfaces both as
    // `AbortError at Timeout.cancelListenerHandler` (27/19 in 0.56.4)
    // and indirectly as `Error at TelemetryClient2.trackException
    // AbortError` when the AI sender's HTTP request itself is aborted
    // during shutdown (24/20). Always expected.
    if (e.name === 'AbortError' || e.message === 'The operation was aborted' || e.message === 'This operation was aborted') {
      return true
    }
    // Version JSON is missing -- user deleted versions/<v>/<v>.json
    // or never finished installing the version. Already handled by
    // the launcher UI (offers re-install); suppress telemetry storm.
    if (e.name === 'MissingVersionJson') {
      return true
    }
    // `linkOrCopyFile` -> ENOENT when the destination's mods folder
    // hasn't been created yet (e.g. instance points at a freshly
    // cleaned directory). InstallService now ensures the folder
    // before copying, but keep this guard as a last line of defense
    // in case any other caller forgets. 21 ev / 5 users in 0.56.4.
    if (e.name === 'OptifineInstallError' && /ENOENT/.test(e.message)) {
      return true
    }
    // `rm -rf <instance>` failed because the user has a file open in
    // the directory (Explorer window, antivirus scan, running game).
    // 21/14 in 0.56.4 -- not a defect, user action required.
    if (e.name === 'InstanceDeleteError' && isSystemError(e) && (e.code === 'EBUSY' || e.code === 'ENOTEMPTY')) {
      return true
    }
    // Microsoft OAuth standard error responses that mean "user closed
    // / denied / the auth server is having a moment". Follow-up to
    // #1445: the existing isExpectedAuthFailure / isKnownXErr cover
    // the XBox numeric XErr codes but not the OAuth-layer codes that
    // come back from MSAL itself.
    if (e.name === 'MicrosoftOLoginMicrosoftError' && typeof e.message === 'string' &&
        /\b(access_denied|server_error|invalid_request|consent_required|interaction_required|login_required|user_cancelled)\b/.test(e.message)) {
      return true
    }
    // node-sqlite3-wasm surfaces native open failures as plain `Error`
    // with messages like `Failed to open: Access is denied. (0x5)`
    // (147/33 users in 0.56.4). They're the same OS-level class as
    // SQLite3Error "unable to open database file" but lose the
    // `SQLite3Error` constructor across the WASM boundary, so the
    // existing guard above doesn't catch them. Permission denied on
    // the data dir is user/AV state, not a defect.
    if (typeof e.message === 'string' && /^Failed to open:.*\(0x[0-9A-Fa-f]+\)/.test(e.message)) {
      return true
    }
    // User picked a folder that doesn't contain a launcher install when
    // running the migrate wizard (e.g. drive root, plain folder). The
    // parser surfaces it as `BadInstance` (ENOENT on a well-known path).
    // 139 users in 0.56.4 — user-driven, not a defect (issue #1469).
    if (e.name === 'BadInstance') {
      return true
    }
    // User tried to open a non-zip file as a modpack (.rar / .7z /
    // corrupt download). The renderer now shows a friendly
    // `ModpackException(invalidModpack)`, but suppress raw `InvalidZipFile`
    // as a last line of defense in case any other caller bubbles it
    // through (issue #1469 — 79 users in 0.56.4).
    if (e.name === 'InvalidZipFile' || e.name === 'InvalidZipFileError') {
      return true
    }
    // Third-party API outages (Modrinth/CurseForge/Mojang/Yggdrasil).
    // A nginx 502/503/504 affects every launcher session simultaneously
    // — June 12 2026 Modrinth outage produced 1830 events / 825 users
    // in a single day, all on `getProjectVersionsByHash`. The launcher
    // has no fix to apply, the user sees the right empty/error state,
    // and the alert noise drowns out real bugs. Match on both the
    // canonical "Status=5xx" prefix our clients prepend and on
    // standalone status numbers in case the upstream omits a body.
    const thirdPartyName = e.name === 'ModerinthApiError' || e.name === 'ModrinthApiError' ||
      e.name === 'CurseforgeApiError' || e.name === 'MojangFriendsError' ||
      e.name === 'YggdrasilError' || e.name === 'MojangApiError'
    if (thirdPartyName && typeof e.message === 'string' &&
        /\b(?:Status=)?5\d{2}\b/.test(e.message)) {
      return true
    }
    // Self-host updater: Vercel proxy returns intermittent 502/503/504
    // for the update channel (issue #1456 — 218 users in 0.56.7).
    // Also covers transient DNS/socket failures while polling for
    // updates. Real install-side `UpdateError` (rename/copy failure on
    // disk) lacks a 5xx and has no network code in its cause, so it
    // continues to bubble through and remain visible in telemetry.
    if (e.name === 'UpdateError') {
      const msg = typeof e.message === 'string' ? e.message : ''
      const has5xx = /\b(?:Status=)?(?:502|503|504)\b/.test(msg)
      const NET_CODES = ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED']
      const isNetworkCause = (err: any): boolean => {
        if (!err) return false
        if (typeof err.code === 'string' && NET_CODES.includes(err.code)) return true
        if (typeof err.message === 'string' &&
            new RegExp(`(?:${NET_CODES.join('|')})`).test(err.message)) return true
        return isNetworkCause(err.cause)
      }
      if (has5xx || isNetworkCause(e)) {
        return true
      }
    }
    return false
  }
}
