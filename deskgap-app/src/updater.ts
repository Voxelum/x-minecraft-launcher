import type { ReleaseInfo } from '@xmcl/runtime-api'
import type { DownloadUpdateOptions, LauncherAppUpdater } from '@xmcl/runtime/app'
import { checksum } from '@xmcl/runtime/util/fs'
import type { windowsExecutable } from 'deskgap'
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { gt } from 'semver'
import { findDeskGapRelease, type DeskGapRelease } from './updateFeed'

export const deskGapPublisherNames = Object.freeze([
  'CN=SignPath Foundation, O=SignPath Foundation, L=Lewes, S=Delaware, C=US',
])

export interface DeskGapUpdaterOptions {
  version: string
  repository: string
  directory: string
  fetch: typeof fetch
  executable: typeof windowsExecutable
  download(url: string, destination: string, options?: DownloadUpdateOptions): Promise<void>
  getSettings(): Promise<{ allowPrerelease: boolean }>
  restart(relaunch: boolean): Promise<void>
}

export class DeskGapUpdater implements LauncherAppUpdater {
  private approved?: { release: ReleaseInfo; asset: DeskGapRelease }
  private downloaded?: { path: string; sha256: string }
  private busy = false

  constructor(private readonly options: DeskGapUpdaterOptions) {}

  async checkUpdateTask(): Promise<ReleaseInfo> {
    if (this.busy) throw new Error('A DeskGap update operation is already running')
    if (!this.options.executable.isSupported() || process.arch !== 'x64') {
      throw new Error('Automatic DeskGap updates require Windows x64 Authenticode support')
    }
    this.busy = true
    try {
      const { allowPrerelease } = await this.options.getSettings()
      const asset = await findDeskGapRelease(this.options.fetch, this.options.repository, allowPrerelease)
      if (!asset || !gt(asset.version, this.options.version)) {
        this.approved = undefined
        this.downloaded = undefined
        return { name: this.options.version, body: '', date: '', files: [], newUpdate: false, operation: 'deskgap' }
      }
      if (this.approved?.asset.version === asset.version && this.approved.asset.url === asset.url && this.approved.asset.size === asset.size) {
        return this.approved.release
      }
      const release: ReleaseInfo = {
        name: asset.version, body: asset.body, date: asset.date,
        files: [{ name: asset.name, url: asset.url }], newUpdate: true, operation: 'deskgap',
      }
      this.approved = { release, asset }
      this.downloaded = undefined
      return release
    } finally {
      this.busy = false
    }
  }

  private getApproved(release: ReleaseInfo) {
    const approved = this.approved
    if (!approved || !release.newUpdate || release.name !== approved.release.name ||
      release.operation !== 'deskgap' || release.files.length !== 1 ||
      release.files[0].url !== approved.asset.url || release.files[0].name !== approved.asset.name) {
      throw new Error('DeskGap update is stale or has not been checked in this session')
    }
    return approved.asset
  }

  async downloadUpdate(release: ReleaseInfo, options?: DownloadUpdateOptions): Promise<void> {
    if (this.busy) throw new Error('A DeskGap update operation is already running')
    const asset = this.getApproved(release)
    options?.abortSignal?.throwIfAborted()
    this.busy = true
    let directory: string | undefined
    try {
      await mkdir(this.options.directory, { recursive: true })
      directory = await mkdtemp(join(this.options.directory, 'download-'))
      const path = join(directory, asset.name)
      await this.options.download(asset.url, path, options)
      options?.abortSignal?.throwIfAborted()
      if ((await stat(path)).size !== asset.size) throw new Error('DeskGap executable download size mismatch')
      const sha256 = await checksum(path, 'sha256')
      await this.options.executable.verifySignature(path, deskGapPublisherNames)
      options?.abortSignal?.throwIfAborted()
      // The native installer copies and re-verifies these exact bytes before spawning.
      this.downloaded = { path, sha256 }
    } catch (error) {
      if (directory) await rm(directory, { recursive: true, force: true })
      throw error
    } finally {
      this.busy = false
    }
  }

  async installUpdateAndQuit(release: ReleaseInfo): Promise<void> {
    this.getApproved(release)
    if (this.busy) throw new Error('A DeskGap update operation is already running')
    if (!this.downloaded) throw new Error('DeskGap update must be downloaded and verified before installation')
    this.busy = true
    try {
      await this.install()
      this.downloaded = undefined
      await this.options.restart(false)
    } finally {
      this.busy = false
    }
  }

  async installOnQuit(): Promise<void> {
    if (!this.downloaded || this.busy) return
    this.busy = true
    try {
      await this.install()
      this.downloaded = undefined
    } finally {
      this.busy = false
    }
  }

  private install() {
    if (!this.downloaded) throw new Error('No verified DeskGap executable to install')
    return this.options.executable.install(this.downloaded.path, {
      publisherNames: deskGapPublisherNames,
      sha256: this.downloaded.sha256,
      args: [`--deskgap-wait-for-pid=${process.pid}`],
      quit: false,
    })
  }
}

export class LocalDevelopmentUpdater implements LauncherAppUpdater {
  constructor(private readonly version: string) {}

  async checkUpdateTask(): Promise<ReleaseInfo> {
    return { name: this.version, body: '', date: '', files: [], newUpdate: false, operation: 'manual' }
  }

  async downloadUpdate(): Promise<void> {
    throw new Error('Launcher updates are disabled in the local DeskGap development host.')
  }

  async installUpdateAndQuit(): Promise<void> {
    throw new Error('Launcher updates are disabled in the local DeskGap development host.')
  }
}
