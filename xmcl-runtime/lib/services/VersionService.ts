import { ResolvedVersion, Version } from '@xmcl/core'
import { VersionService as IVersionService, VersionServiceKey, VersionState } from '@xmcl/runtime-api'
import { isNonnull } from '@xmcl/runtime-api/utils'
import { task } from '@xmcl/task'
import { remove } from 'fs-extra'
import { join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { CopyDirectoryTask, FileStateWatcher, missing, readdirEnsured } from '../util/fs'
import { ExportService, StatefulService } from './Service'

/**
 * The local version serivce maintains the installed versions on disk
 */
@ExportService(VersionServiceKey)
export default class VersionService extends StatefulService<VersionState> implements IVersionService {
  private versionsWatcher = new FileStateWatcher([] as string[], (state, _, f) => [...new Set([...state, f])])

  private versionLoaded = false

  constructor(app: LauncherApp) {
    super(app, async () => {
      await this.refreshVersions()
      if (this.state.local.length === 0) {
        this.migrateMinecraftFile()
      }
      this.versionsWatcher.watch(this.getPath('versions'))
    })
  }

  createState() { return new VersionState() }

  async dispose() {
    this.versionsWatcher.close()
  }

  /**
   * Scan .minecraft folder and copy libraries/assets/versions files from it to launcher managed place.
   *
   * This will not replace the existed files
   */
  async migrateMinecraftFile(mcPath: string = this.getMinecraftPath()) {
    if (await missing(mcPath)) return
    const root = this.getPath()
    if (mcPath === root) return
    this.log(`Try to migrate the version from ${mcPath}`)
    const copyTask = task('cloneMinecraft', async () => {
      await this.worker().copyPassively([
        { src: join(mcPath, 'libraries'), dest: join(root, 'libraries') },
        { src: join(mcPath, 'assets'), dest: join(root, 'assets') },
        { src: join(mcPath, 'versions'), dest: join(root, 'versions') },
      ])
    })
    // const task = new CopyDirectoryTask([
    //   { src: join(mcPath, 'libraries'), dest: join(root, 'libraries') },
    //   { src: join(mcPath, 'assets'), dest: join(root, 'assets') },
    //   { src: join(mcPath, 'versions'), dest: join(root, 'versions') },
    // ]).setName('cloneMinecraft')
    Reflect.set(copyTask, '_from', mcPath)
    await this.taskManager.submit(copyTask)
  }

  public async resolveLocalVersion(versionFolder: string, root: string = this.getPath()): Promise<ResolvedVersion> {
    const resolved = await Version.parse(root, versionFolder)
    return Object.freeze(resolved)
  }

  public getLocalVersion(versionId: string) {
    return this.state.local.find(v => v.id === versionId)
  }

  /**
   * Refresh a version in the version folder.
   * @param versionFolder The version folder name. It must existed under the `versions` folder.
   */
  async refreshVersion(versionFolder: string) {
    try {
      const version = await this.resolveLocalVersion(versionFolder)
      this.log(`Refresh local version ${versionFolder}`)
      this.state.localVersionAdd(version)
    } catch (e) {
      this.state.localVersionRemove(versionFolder)
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

    const versions: ResolvedVersion[] = (await Promise.all(files.map(async (versionId) => {
      try {
        const version = await this.resolveLocalVersion(versionId)
        return version
      } catch (e) {
        this.warn(`An error occured during refresh local version ${versionId}`)
        this.warn(e)
      }
    }))).filter(isNonnull)

    if (versions.length !== 0) {
      if (patch) {
        for (const version of versions) {
          this.state.localVersionAdd(version)
        }
      } else {
        this.state.localVersions(versions)
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
    this.state.localVersions(this.state.local.filter(v => v.id !== version))
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
