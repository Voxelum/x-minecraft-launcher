import { ElectronUpdateOperation, ReleaseInfo } from '@xmcl/runtime-api'
import type { DownloadUpdateOptions, LauncherApp, LauncherAppUpdater } from '@xmcl/runtime/app'
import { IS_DEV } from '@xmcl/runtime/constant'
import type { Logger } from '@xmcl/runtime/infra'
import { kSettings } from '@xmcl/runtime/settings'
import { AnyError } from '@xmcl/utils'
import { EventEmitter } from 'events'
import { ShellClient } from '../shell/ShellClient'

function isSameVersion(current: string, tag: string) {
  const version = tag.startsWith('v') ? tag.substring(1) : tag
  return version === current
}

/**
 * Updater of the Tauri shell.
 *
 * The check against `api.xmcl.app/latest` is shell-independent and stays as it
 * is, because the UI renders its release notes and asset list. Applying the
 * update is not: there is no `app.asar` to swap and no `electron-updater`, so
 * the operations are delegated to the shell, which runs the Tauri updater and
 * answers on the shell channel (see `src-tauri/src/updater.rs`).
 *
 * The shell only accepts an update signed with the key the bundle was built
 * with. A build whose bundle declares no update endpoint or public key — a
 * development build, or a fork publishing no manifest — makes the shell fail the
 * check, and the release is then reported as `Manual`, which sends the user to
 * the download page instead of pretending an in-place update happened.
 */
export class TauriUpdater implements LauncherAppUpdater {
  private readonly logger: Logger

  constructor(
    private readonly app: LauncherApp,
    private readonly shell: ShellClient,
  ) {
    this.logger = app.getLogger('TauriUpdater')
  }

  /**
   * Wait for the shell's answer to an update command. Every update command
   * answers with exactly one terminal event, `update-error` included, so the
   * listeners are always released.
   */
  private wait<T>(
    resolved: { [event: string]: (...args: any[]) => T },
    onProgress?: (downloaded: number, total?: number) => void,
  ) {
    // The declared `on` overloads of the client are per-event, so the dynamic
    // subscription goes through the emitter itself.
    const shell: EventEmitter = this.shell
    return new Promise<T>((resolve, reject) => {
      const events = Object.entries(resolved)
      const progress = onProgress ?? (() => {})
      const dispose = () => {
        for (const [event] of events) shell.off(event, handlers.get(event)!)
        shell.off('update-error', onError)
        shell.off('update-progress', progress)
      }
      const onError = (message: string) => {
        dispose()
        reject(new AnyError('UpdateError', message))
      }
      const handlers = new Map(
        events.map(([event, map]) => [
          event,
          (...args: any[]) => {
            dispose()
            resolve(map(...args))
          },
        ]),
      )
      for (const [event, handler] of handlers) shell.on(event, handler)
      shell.on('update-error', onError)
      shell.on('update-progress', progress)
    })
  }

  /**
   * Whether the shell can install this release itself. The shell's own check is
   * the authority: it knows the bundle's endpoint, its signing key and which
   * artifact matches the running installation.
   */
  private async canSelfUpdate() {
    const asked = this.wait<boolean>({
      'update-available': () => true,
      'update-not-available': () => false,
    })
    this.shell.checkUpdate()
    try {
      return await asked
    } catch (e) {
      this.logger.warn(e as Error)
      return false
    }
  }

  async checkUpdateTask(): Promise<ReleaseInfo> {
    const { allowPrerelease, locale } = await this.app.registry.get(kSettings)
    const query = `version=v${this.app.version}&prerelease=${allowPrerelease || false}`
    const response = await this.app.fetch(`https://api.xmcl.app/latest?${query}`, {
      headers: { 'Accept-Language': locale },
    })
    if (!response.ok) {
      throw new AnyError('UpdateError', `Fail to get the latest release: ${response.status}`)
    }
    const result = await response.json() as any
    this.logger.log(`Got release ${result.tag_name}`)
    const newUpdate = !isSameVersion(this.app.version, result.tag_name)
    return {
      name: result.tag_name,
      body: result.body,
      date: result.published_at,
      files: (result.assets ?? []).map((a: any) => ({ url: a.browser_download_url, name: a.name })),
      newUpdate,
      // `AutoUpdater` is the operation of a shell installing the release on its
      // own, which is exactly what the Tauri updater does.
      operation: newUpdate && (await this.canSelfUpdate())
        ? ElectronUpdateOperation.AutoUpdater
        : ElectronUpdateOperation.Manual,
    }
  }

  async downloadUpdate(updateInfo: ReleaseInfo, options?: DownloadUpdateOptions): Promise<void> {
    if (updateInfo.operation !== ElectronUpdateOperation.AutoUpdater) {
      options?.tracker?.({ phase: 'download-update.manual', payload: {} })
      throw new AnyError(
        'UpdateError',
        'This build cannot install updates in place; the release has to be downloaded manually.',
      )
    }
    const tracker = { progress: 0, total: 0, url: '' }
    options?.tracker?.({ phase: 'download-update.full', payload: { progress: tracker } })
    const downloaded = this.wait<void>({ 'update-downloaded': () => undefined }, (progress, total) => {
      tracker.progress = progress
      tracker.total = total ?? 0
    })
    this.shell.downloadUpdate()
    await downloaded
    this.logger.log(`Downloaded the update ${updateInfo.name}`)
  }

  async installUpdateAndQuit(updateInfo: ReleaseInfo): Promise<void> {
    if (IS_DEV) {
      this.logger.log('Currently is development environment. Skip to install update')
      return
    }
    if (updateInfo.operation !== ElectronUpdateOperation.AutoUpdater) {
      throw new AnyError(
        'UpdateError',
        'This build cannot install updates in place; the release has to be installed manually.',
      )
    }
    // The shell replaces the installation and relaunches, so this only returns
    // when the install failed.
    const failed = this.wait<void>({})
    this.shell.installUpdate()
    await failed
  }
}
