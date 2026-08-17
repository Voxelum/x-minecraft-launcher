import { ElectronUpdateOperation, ReleaseInfo } from '@xmcl/runtime-api'
import type { LauncherApp, LauncherAppUpdater } from '@xmcl/runtime/app'
import type { Logger } from '@xmcl/runtime/infra'
import { kSettings } from '@xmcl/runtime/settings'
import { AnyError } from '@xmcl/utils'

function isSameVersion(current: string, tag: string) {
  const version = tag.startsWith('v') ? tag.substring(1) : tag
  return version === current
}

/**
 * Update check for the Tauri shell.
 *
 * The check itself is shell-independent — it is the same `api.xmcl.app/latest`
 * query the Electron build performs — so the UI keeps showing releases and
 * changelogs. Applying an update is not: the Electron build swaps the `app.asar`
 * or defers to `electron-updater`, neither of which exists here. Until the
 * shell's own updater is wired up, the operation is reported as `Manual`, which
 * makes the UI send the user to the download page instead of pretending an
 * in-place update happened.
 */
export class TauriUpdater implements LauncherAppUpdater {
  private readonly logger: Logger

  constructor(private readonly app: LauncherApp) {
    this.logger = app.getLogger('TauriUpdater')
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
    return {
      name: result.tag_name,
      body: result.body,
      date: result.published_at,
      files: (result.assets ?? []).map((a: any) => ({ url: a.browser_download_url, name: a.name })),
      newUpdate: !isSameVersion(this.app.version, result.tag_name),
      operation: ElectronUpdateOperation.Manual,
    }
  }

  async downloadUpdate(): Promise<void> {
    throw new AnyError(
      'UpdateError',
      'The Tauri shell cannot download updates in place yet; the release has to be installed manually.',
    )
  }

  async installUpdateAndQuit(): Promise<void> {
    throw new AnyError(
      'UpdateError',
      'The Tauri shell cannot install updates in place yet; the release has to be installed manually.',
    )
  }
}
