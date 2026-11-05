import type { DownloadUpdateOptions, LauncherAppUpdater } from '@xmcl/runtime/app'
import type { ReleaseInfo } from '@xmcl/runtime-api'

/** Updates stay disabled until Vardrynn has its own signed release channel. */
export class ElectronUpdater implements LauncherAppUpdater {
  readonly capability = { automatic: false, reason: 'not-configured' } as const

  constructor(_app?: unknown) {}

  async checkUpdateTask(): Promise<ReleaseInfo> {
    throw new Error('Vardrynn updates are unavailable until a Vardrynn release source is configured')
  }

  async downloadUpdate(_updateInfo: ReleaseInfo, _options?: DownloadUpdateOptions): Promise<void> {
    throw new Error('Vardrynn update downloads are unavailable')
  }

  async installUpdateAndQuit(_updateInfo: ReleaseInfo): Promise<void> {
    throw new Error('Vardrynn update installation is unavailable')
  }
}
