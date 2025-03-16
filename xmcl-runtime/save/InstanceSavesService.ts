import { UnzipTask } from '@xmcl/installer'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  getInstanceSaveKey,
  InstanceSavesService as IInstanceSavesService,
  ImportSaveException,
  ImportSaveOptions,
  InstallMarketOptionWithInstance,
  InstanceSavesServiceKey,
  LaunchOptions,
  LinkSaveAsServerWorldOptions,
  LockKey,
  MarketType,
  Saves,
  ShareSaveOptions,
} from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import { FSWatcher } from 'chokidar'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureDir, ensureFile, readdir, rename, rm, rmdir, stat, unlink, writeFile } from 'fs-extra'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, PathResolver } from '~/app'
import { InstanceService } from '~/instance'
import { LaunchService } from '~/launch'
import { kMarketProvider } from '~/market'
import { ResourceManager } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { AnyError, isSystemError } from '~/util/error'
import { readlinkSafe } from '~/util/linkResourceFolder'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, isDirectory, linkDirectory, missing, readdirIfPresent } from '../util/fs'
import { isNonnull, requireObject, requireString } from '../util/object'
import { ZipTask } from '../util/zip'
import { getInstanceSaveHeader, readInstanceSaveMetadata } from './save'

/**
 * Provide the ability to preview saves data of an instance
 */
@ExposeServiceKey(InstanceSavesServiceKey)
export class InstanceSavesService extends AbstractService implements IInstanceSavesService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(ResourceManager) resourceManager: ResourceManager,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app, async () => {
      const snapshopts = await resourceManager.getSnapshotsUnderDomainedPath('saves')
      const valid = await Promise.all(snapshopts.map(v => resourceManager.validateSnapshotFile(v)))
      for (const file of valid) {
        if (!file) continue
        // unlink if the file last access time is 3 days ago
        if (file.atime < Date.now() - 1000 * 60 * 60 * 24 * 3) {
          await unlink(file.path)
        }
      }
      await ensureDir(this.getPath('saves'))
      if (existsSync(this.getPath('shared-saves'))) {
        // move all shared saves to saves
        const sharedSaves = await readdir(this.getPath('shared-saves'))
        for (const save of sharedSaves) {
          await rename(this.getPath('shared-saves', save), this.getPath('saves', save))
        }
        await rmdir(this.getPath('shared-saves'))
      }
    })
  }

  async getLinkedSaveWorld(instancePath: string): Promise<string | undefined> {
    const serverWorldPath = join(instancePath, 'server', 'world')
    if (await missing(serverWorldPath)) {
      return undefined
    }
    // check if is a link, if so, then read the link and return the link path
    const linked = await readlinkSafe(serverWorldPath).catch(() => '')
    if (linked) {
      return linked
    }

    return serverWorldPath
  }

  async linkSaveAsServerWorld(options: LinkSaveAsServerWorldOptions): Promise<void> {
    const { instancePath, saveName } = options
    this.log(`Link save ${saveName} as server world in instance ${instancePath}.`)

    requireString(saveName)

    const savePath = isAbsolute(saveName) ? saveName : join(instancePath, 'saves', saveName)

    if (await missing(savePath)) {
      throw new AnyError('InstanceLinkSaveNotFoundError', 'The save is not found.', undefined, { saveName })
    }

    const serverWorldPath = join(instancePath, 'server', 'world')

    if (existsSync(serverWorldPath)) {
      const linkedTarget = await this.getLinkedSaveWorld(instancePath)
      if (linkedTarget === savePath) {
        this.log(`The save ${saveName} is already linked as server world in instance ${instancePath}.`)
        return
      }
      if (linkedTarget === serverWorldPath) {
        // Try to rename the world folder to world-backup
        let backupPath = join(instancePath, 'world-backup')
        while (await missing(backupPath)) {
          try {
            this.log(`Rename the world folder to world-backup in instance ${instancePath}.`)
            await rename(serverWorldPath, backupPath)
          } catch (e) {
            if (isSystemError(e) && e.code === 'EEXIST') {
              backupPath += '-backup'
            } else {
              throw e
            }
          }
        }
      } else if (linkedTarget) {
        // remove the linked world
        this.log(`Remove the linked world in instance ${instancePath}.`)
        await rm(serverWorldPath)
      }
    }

    this.log(`Link save ${saveName} as server world in instance ${instancePath}.`)
    await linkDirectory(savePath, serverWorldPath, this)
  }

  async showDirectory(instancePath: string): Promise<void> {
    this.app.shell.openDirectory(join(instancePath, 'saves'))
  }

  async getInstanceSaves(path: string) {
    const baseName = basename(path)
    const saveRoot = join(path, 'saves')
    const saves = await readdirIfPresent(saveRoot).then(a => a.filter(s => !s.startsWith('.')))
    const metadatas = Promise.all(saves
      .map(s => resolve(saveRoot, s))
      .map((p) => getInstanceSaveHeader(p, baseName)))
    return metadatas
  }

  /**
   * Mount and load instances saves
   * @param path
   */
  async watch(path: string) {
    requireString(path)
    const lock = this.mutex.of(LockKey.instance(path))

    const stateManager = await this.app.registry.get(ServiceStateManager)
    const launchService = await this.app.registry.get(LaunchService)

    return stateManager.registerOrGet(getInstanceSaveKey(path), async ({ defineAsyncOperation }) => {
      const pending: Set<string> = new Set()
      const baseName = basename(path)
      const savesDir = join(path, 'saves')
      const state = new Saves()

      const onExit = (op: LaunchOptions) => {
        if (op.gameDirectory !== path) return
        for (const p of pending) {
          updateSave(p)
        }
        pending.clear()
      }
      launchService.on('minecraft-exit', onExit)

      const updateSave = defineAsyncOperation(async (filePath: string) => {
        await lock.runExclusive(() => readInstanceSaveMetadata(filePath, baseName).then((save) => {
          state.instanceSaveUpdate(save)
        }).catch((e) => {
          this.warn(`Parse save in ${filePath} failed. Skip it.`)
          this.warn(e)
        }))
      })

      const watcher = new FSWatcher({
        awaitWriteFinish: true,
        ignorePermissionErrors: true,
        followSymlinks: true,
        cwd: path,
        depth: 2,
        ignored: (path, stat) => {
          if (resolve(path) === savesDir) return false
          const depth = relative(savesDir, path).split('/').length
          if (depth === 2) {
            const fileName = basename(path)
            return fileName === 'level.dat'
          }
          if (depth > 2) {
            return true
          }
          return false
        },
      })

      watcher
        .on('error', (e) => {
          if (isSystemError(e)) {
            if (e.code === 'EBUSY') {
              return
            }
          }
          if ((e as any).name === 'Error') {
            (e as any).name = 'FSWatcherError'
          }
          this.error(e as any)
        })
        .on('all', (event, file, stat) => {
          const absPath = resolve(path, file)
          if (file.endsWith('level.dat')) {
            const savePath = dirname(absPath)
            if (event === 'add' || event === 'change') {
              if (launchService.isParked(path)) {
                pending.add(savePath)
              } else {
                updateSave(savePath)
              }
            } else if (event === 'unlink') {
              state.instanceSaveRemove(savePath)
            }
          } else if (file.endsWith('.zip')) {
            if (dirname(absPath) === resolve(savesDir)) {
              // deploy the zip
              this.importSave({
                instancePath: path,
                path: absPath,
              })
            }
          } else if (event === 'unlinkDir' && (file === path || !file)) {
            dispose()
          }
        })
        .add(savesDir)

      const revalidate = async () => {
        // TODO: getWatched and revalidate
      }

      const dispose = () => {
        launchService.off('minecraft-exit', onExit)
        watcher?.close()
      }

      return [state, dispose, revalidate]
    })
  }

  /**
   * Clone a save under an instance to one or multiple instances.
   *
   * @param options
   */
  async cloneSave(options: CloneSaveOptions) {
    const { srcInstancePath, destInstancePath, saveName, newSaveName } = options

    requireString(saveName)

    const destSaveName = newSaveName ?? saveName

    const destInstancePaths = typeof destInstancePath === 'string' ? [destInstancePath] : destInstancePath

    const srcSavePath = join(srcInstancePath, saveName)

    if (await missing(srcSavePath)) {
      throw new AnyError('CloneSaveSaveNotFoundError', `Cannot find save ${saveName}`, undefined, {
        saveName,
      })
    }
    if (destInstancePaths.some(p => !this.instanceService.state.all[p])) {
      const notFound = destInstancePaths.find(p => !this.instanceService.state.all[p])!
      throw new AnyError('CloneSaveInstanceNotFoundError', `Cannot find managed instance ${notFound}`, undefined, {
        instancePath: notFound,
      })
    }

    const destSavePaths = destInstancePaths.map(d => join(d, 'saves', destSaveName))

    for (const dest of destSavePaths) {
      await copyPassively(srcSavePath, dest)
    }
  }

  /**
   * Delete a save in a specific instance.
   *
   * @param options
   */
  async deleteSave(options: DeleteSaveOptions) {
    const { saveName, instancePath } = options

    requireString(saveName)

    const savePath = instancePath ? join(instancePath, 'saves', saveName) : this.getPath('saves', saveName)

    if (await missing(savePath)) {
      return
    }

    await rm(savePath, { recursive: true, force: true })
  }

  async shareSave(options: ShareSaveOptions): Promise<void> {
    const { instancePath, saveName } = options

    requireString(saveName)

    const savePath = join(instancePath, 'saves', saveName)

    if (await missing(savePath)) {
      throw new AnyError('InstanceDeleteNoSave', `Cannot find save ${saveName}`, undefined, {
        saveName,
      })
    }

    await ensureDir(this.getPath('saves'))
    let destSharedSavePath = this.getPath('saves', saveName)

    if (await missing(destSharedSavePath)) {
      await rename(savePath, destSharedSavePath)
    } else {
      // move the save to shared save with a new name
      destSharedSavePath = this.getPath('saves', `${saveName}-${Date.now()}`)
      await rename(savePath, destSharedSavePath)
    }
  }

  async importSave(options: ImportSaveOptions) {
    let { instancePath, saveName, path, curseforge } = options

    if (!this.instanceService.state.all[instancePath]) {
      throw new Error(`Cannot find managed instance ${instancePath}`)
    }

    // normalize the save name
    saveName = filenamify(saveName ?? basename(path))
    let dest = join(instancePath, 'saves', basename(saveName, extname(saveName)))
    let i = 1
    while (existsSync(dest)) {
      dest = join(instancePath, 'saves', `${saveName} (${i++})`)
    }

    const isDir = await isDirectory(path)

    if (isDir) {
      if (!existsSync(join(path, 'level.dat'))) {
        throw new ImportSaveException({ type: 'instanceImportIllegalSave', path })
      }

      const sharedSavesDir = this.getPath('saves')
      // if path is direct child of saves, we need to link it else we copy it
      if (path.startsWith(sharedSavesDir)) {
        await linkDirectory(path, dest, this)
      } else {
        await copyPassively(path, dest)
      }
    } else {
      // validate the source
      const zipFile = await open(path)
      const entries = await readAllEntries(zipFile)

      let saveRoot = undefined as string | undefined
      for (const e of entries) {
        if (e.fileName.endsWith('/level.dat')) {
          saveRoot = e.fileName.substring(0, e.fileName.length - '/level.dat'.length)
          break
        }
        if (e.fileName === 'level.dat') {
          saveRoot = ''
          break
        }
      }

      if (saveRoot === undefined) {
        throw new ImportSaveException({ type: 'instanceImportIllegalSave', path })
      }

      const root = saveRoot

      const task = new UnzipTask(zipFile, entries.filter(e => !e.fileName.endsWith('/') && e.fileName.startsWith(root)), dest, (e) => {
        return e.fileName.substring(root.length)
      })
      await task.startAndWait()
    }

    if (curseforge) {
      await writeFile(join(dest, '.curseforge'), JSON.stringify({
        projectId: curseforge.projectId,
        fileId: curseforge.fileId,
      }))
    }

    return dest
  }

  /**
   * Export a save from a managed instance to an external location.
   *
   * You can choose export the save to zip or a folder.
   *
   * @param options
   */
  async exportSave(options: ExportSaveOptions) {
    requireObject(options)

    const { instancePath, saveName, zip = true, destination } = options

    requireString(saveName)
    requireString(destination)

    const source = join(instancePath, saveName)

    if (!this.instanceService.state.all[instancePath]) {
      throw new Error(`Cannot find managed instance ${instancePath}`)
    }

    if (await missing(instancePath)) {
      throw new Error(`Cannot find managed instance ${instancePath}`)
    }

    this.log(`Export save from ${instancePath}:${saveName} to ${destination}.`)

    if (!zip) {
      // copy to folder
      await ensureDir(destination)
      await copyPassively(source, destination)
    } else {
      // compress to zip
      await ensureFile(destination)
      const zipTask = new ZipTask(destination)
      await zipTask.includeAs(source, '')
      await zipTask.startAndWait()
    }
  }

  async isSaveLinked(instancePath: string) {
    const sharedSave = this.getPath('saves')
    const instanceSave = join(instancePath, 'saves')
    const isLinked = await readlinkSafe(instanceSave).catch(() => '') === sharedSave
    return isLinked
  }

  async linkSharedSave(instancePath: string) {
    const sharedSave = this.getPath('saves')
    const instanceSaves = join(instancePath, 'saves')
    await ensureDir(sharedSave)

    if (await readlinkSafe(instanceSaves).catch(() => '') === sharedSave) {
      return
    }

    if (await missing(instanceSaves)) {
      await linkDirectory(sharedSave, instanceSaves, this)
      return
    }

    // existed folder we need to merge to shared
    // move all saves to shared
    const saves = await readdir(instanceSaves)
    for (const saveName of saves) {
      const savePath = join(instanceSaves, saveName)
      // check if shared folder has the same save
      const sharedSavePath = join(sharedSave, saveName)
      const isLinked = await readlinkSafe(savePath).catch(() => '')

      if (isLinked) {
        await unlink(savePath)
        continue
      }

      if (await missing(sharedSavePath)) {
        await rename(savePath, sharedSavePath)
      } else {
        // move to shared with a new name
        const newName = `${saveName}-${Date.now()}`
        await rename(savePath, join(sharedSave, newName))
      }
    }

    await rm(instanceSaves, { recursive: true })
    await linkDirectory(sharedSave, instanceSaves, this)
  }

  async unlinkSharedSave(instancePath: string) {
    const sharedSave = this.getPath('saves')
    const instanceSave = join(instancePath, 'saves')
    if (await readlinkSafe(instanceSave).catch(() => '') !== sharedSave) {
      return
    }

    await unlink(instanceSave)
    await ensureDir(instanceSave)
  }

  async getSharedSaves() {
    const sharedSave = this.getPath('saves')
    const saves = await readdirIfPresent(sharedSave).then(a => a.filter(s => !s.startsWith('.')))
    const results = await Promise.allSettled(saves
      .map(s => resolve(sharedSave, s))
      .map(async (p) => {
        const fstat = await stat(p)
        if (fstat.isDirectory()) {
          return await readInstanceSaveMetadata(p, '')
        }
      }))
    return results.map(r => r.status === 'fulfilled' ? r.value : undefined).filter(isNonnull)
  }

  async installFromMarket(options: InstallMarketOptionWithInstance): Promise<string> {
    if (options.market !== MarketType.CurseForge) {
      throw new TypeError('Unsupported market type')
    }
    const provider = await this.app.registry.get(kMarketProvider)
    const [result] = await provider.installFile({
      ...options,
      directory: this.getPath('saves'),
    })
    const savePath = await this.importSave({
      path: result.path,
      curseforge: {
        projectId: result.metadata.curseforge!.projectId,
        fileId: result.metadata.curseforge!.fileId,
      },
      instancePath: options.instancePath,
    })
    return savePath
  }
}
