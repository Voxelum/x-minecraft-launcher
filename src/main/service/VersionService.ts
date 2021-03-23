import { ResolvedVersion, Version } from '@xmcl/core'
import { remove } from 'fs-extra'
import { join } from 'path'
import AbstractService, { Service } from './Service'
import { copyPassively, FileStateWatcher, missing, readdirEnsured } from '/@main/util/fs'
import { VersionServiceKey, VersionService as IVersionService } from '/@shared/services/VersionService'

/**
 * The local version serivce maintains the installed versions on disk
 */
@Service(VersionServiceKey)
export default class VersionService extends AbstractService implements IVersionService {
  private versionsWatcher = new FileStateWatcher([] as string[], (state, _, f) => [...new Set([...state, f])]);

  private versionLoaded = false;

  async dispose() {
    this.versionsWatcher.close()
  }

  async initialize() {
    await this.refreshVersions()
    if (this.state.version.local.length === 0) {
      this.checkLocalMinecraftFiles()
    }
    this.versionsWatcher.watch(this.getPath('versions'))
  }

  /**
   * Scan .minecraft folder and copy libraries/assets/versions files from it to launcher managed place.
   *
   * This will not replace the existed files
   */
  async checkLocalMinecraftFiles() {
    const mcPath = this.getMinecraftPath()
    if (await missing(mcPath)) return
    if (mcPath === this.state.root) return
    this.log('Try to migrate the version from .minecraft')
    await copyPassively(join(mcPath, 'libraries'), join(this.state.root, 'libraries'))
    await copyPassively(join(mcPath, 'assets'), join(this.state.root, 'assets'))
    await copyPassively(join(mcPath, 'versions'), join(this.state.root, 'versions'))
  }

  public async resolveLocalVersion(versionFolder: string, root: string = this.state.root): Promise<ResolvedVersion> {
    const resolved = await Version.parse(root, versionFolder)
    return resolved
  }

  async resolveVersionId() {
    const cur = this.getters.instanceVersion
    if (!cur.id) {
      await this.refreshVersions(true)
    }
    return cur.id
  }

  /**
   * Refresh a version in the version folder.
   * @param versionFolder The version folder name. It must existed under the `versions` folder.
   */
  async refreshVersion(versionFolder: string) {
    try {
      const version = await this.resolveLocalVersion(versionFolder)
      this.log(`Refresh local version ${versionFolder}`)
      this.commit('localVersion', version)
    } catch (e) {
      this.commit('localVersionRemove', versionFolder)
      this.warn(`An error occured during refresh local version ${versionFolder}`)
      this.warn(e)
    }
  }

  async refreshVersions(force?: boolean) {
    /**
      * Read local folder
      */
    let files: string[]
    let patch = false
    if (force) {
      files = await readdirEnsured(this.getPath('versions'))
    } else if (this.versionLoaded) {
      patch = true
      files = this.versionsWatcher.getStateAndReset()
    } else {
      files = await readdirEnsured(this.getPath('versions'))
    }

    files = files.filter(f => !f.startsWith('.'))

    const versions: ResolvedVersion[] = []
    for (const versionId of files) {
      try {
        const version = await this.resolveLocalVersion(versionId)
        versions.push(version)
      } catch (e) {
        this.warn(`An error occured during refresh local version ${versionId}`)
        this.warn(e)
      }
    }

    if (versions.length !== 0) {
      if (patch) {
        for (const version of versions) {
          this.commit('localVersion', version)
        }
      } else {
        this.commit('localVersions', versions)
      }
      this.log(`Found ${versions.length} local game versions.`)
    } else if (patch) {
      this.log('No new version found.')
    } else {
      this.log('No local game version found.')
    }
    this.versionLoaded = true
  }

  async deleteVersion(version: string) {
    const path = this.getPath('versions', version)
    await remove(path)
    this.commit('localVersions', this.state.version.local.filter(v => v.id !== version))
  }

  async showVersionsDirectory() {
    const path = this.getPath('versions')
    return this.app.openDirectory(path)
  }

  async showVersionDirectory(version: string) {
    const path = this.getPath('versions', version)
    return this.app.openDirectory(path)
  }
}
