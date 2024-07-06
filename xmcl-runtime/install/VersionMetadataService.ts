import { VersionMetadataService as IVersionMetadataService, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'

@ExposeServiceKey(VersionMetadataServiceKey)
export class VersionMetadataService extends AbstractService implements IVersionMetadataService {
  private latest = {
    release: '1.20.6',
    snapshot: '21w37a',
  }

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  getLatestRelease() {
    return this.latest.release
  }

  getLatestSnapshot() {
    return this.latest.snapshot
  }

  async getLatestMinecraftRelease() {
    return this.latest.release
  }

  async getLatestMinecraftSnapshot() {
    return this.latest.snapshot
  }

  async setLatestMinecraft(release: string, snapshot: string) {
    this.latest.release = release
    this.latest.snapshot = snapshot
  }
}
