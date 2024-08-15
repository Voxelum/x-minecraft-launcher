import { UnzipTask } from '@xmcl/installer'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  getInstanceSaveKey,
  InstanceSavesService as IInstanceSavesService,
  ImportSaveOptions,
  InstanceSaveException,
  InstanceSavesServiceKey,
  isSaveResource,
  LaunchOptions,
  LinkSaveAsServerWorldOptions,
  LockKey,
  ResourceDomain, Saves,
  ShareSaveOptions,
} from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureDir, ensureFile, readdir, readlink, rename, rm, unlink, writeFile } from 'fs-extra'
import watch from 'node-watch'
import { basename, extname, isAbsolute, join, resolve } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, PathResolver } from '~/app'
import { InstanceService } from '~/instance'
import { LaunchService } from '~/launch'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { isSystemError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, createSymbolicLink, isDirectory, missing, readdirIfPresent } from '../util/fs'
import { isNonnull, requireObject, requireString } from '../util/object'
import { ZipTask } from '../util/zip'
import { getInstanceSaveHeader, readInstanceSaveMetadata } from './save'
import debounce from 'lodash.debounce'

/**
 * Provide the ability to preview saves data of an instance
 */
@ExposeServiceKey(InstanceSavesServiceKey)
export class InstanceSavesService extends AbstractService implements IInstanceSavesService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
    this.resourceService.registerInstaller(ResourceDomain.Saves, async (resource, instancePath) => {
      if (isSaveResource(resource)) {
        await this.importSave({
          instancePath,
          path: resource.path,
          saveRoot: resource.metadata.save?.root,
        })
      }
    })
  }

  async getLinkedSaveWorld(instancePath: string): Promise<string | undefined> {
    const serverWorldPath = join(instancePath, 'server', 'world')
    if (await missing(serverWorldPath)) {
      return undefined
    }
    // check if is a link, if so, then read the link and return the link path
    const linked = await readlink(serverWorldPath).catch(() => '')
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
      // @ts-ignore
      throw new InstanceSaveException({ type: 'instanceLinkSaveNotFound', name: saveName })
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
    await createSymbolicLink(savePath, serverWorldPath, this)
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
    const lock = this.semaphoreManager.getLock(LockKey.instance(path))

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

      const updateSave = debounce(defineAsyncOperation((filePath: string) => {
        return lock.read(() => readInstanceSaveMetadata(filePath, baseName).then((save) => {
          state.instanceSaveUpdate(save)
        }).catch((e) => {
          this.warn(`Parse save in ${filePath} failed. Skip it.`)
          this.warn(e)
        }))
      }), 500)

      const onFileUpdate = (event: 'update' | 'remove', filename: string) => {
        if (filename.startsWith('.')) return
        const filePath = filename
        if (event === 'update') {
          if (launchService.isParked(path)) {
            pending.add(filePath)
          } else {
            updateSave(filePath)
          }
        } else if (state.saves.some((s) => s.path === filename)) {
          state.instanceSaveRemove(filePath)
        }
      }

      let isLinkedMemo = await this.isSaveLinked(path)
      let watcher = watch(savesDir, onFileUpdate)

      this.log(`Watch saves directory: ${savesDir}`)

      const readAll = async (savePaths: string[]) => {
        const saves = await Promise.all(savePaths
          .filter((d) => !d.startsWith('.'))
          .map((d) => join(savesDir, d))
          .map((p) => readInstanceSaveMetadata(p, baseName).catch((e) => {
            this.warn(`Parse save in ${p} failed. Skip it.`)
            this.warn(e)
            return undefined
          })))
        return saves.filter(isNonnull)
      }

      if (!isLinkedMemo) {
        await ensureDir(savesDir)
        const saves = await lock.read(async () => await readAll(await readdir(savesDir)))
        this.log(`Found ${saves.length} saves in instance ${path}`)
        state.saves = saves
      }

      const revalidate = () => lock.read(async () => {
        const newIsLink = !!await readlink(savesDir).catch(() => '')
        if (newIsLink !== isLinkedMemo) {
          isLinkedMemo = !!newIsLink
          watcher = watch(savesDir, onFileUpdate)
          const savePaths = await readdir(savesDir)
          const saves = await readAll(savePaths)
          state.instanceSaves(saves)
        } else if (!newIsLink) {
          const savePaths = await readdir(savesDir)
          if (savePaths.length !== state.saves.length) {
            const toRemove = state.saves.filter((s) => !savePaths.includes(basename(s.path)))
            toRemove.forEach((s) => state.instanceSaveRemove(s.path))
            const toAdd = savePaths.filter((s) => !state.saves.some((ss) => ss.name === s))
            await readAll(toAdd)
          }
        }
      })

      return [state, () => {
        launchService.off('minecraft-exit', onExit)
        watcher.close()
      }, revalidate]
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
      throw new InstanceSaveException({ type: 'instanceCopySaveNotFound', src: srcSavePath, dest: destInstancePaths },
        `Cancel save copying of ${saveName}`)
    }
    // if (!this.instanceService.state.all[srcInstancePath]) {
    //   throw new InstanceSaveException({
    //     type: 'instanceNotFound',
    //     instancePath: srcInstancePath,
    //   }, `Cannot find managed instance ${srcInstancePath}`)
    // }
    if (destInstancePaths.some(p => !this.instanceService.state.all[p])) {
      const notFound = destInstancePaths.find(p => !this.instanceService.state.all[p])!
      throw new InstanceSaveException({
        type: 'instanceNotFound',
        instancePath: notFound,
      }, `Cannot find managed instance ${notFound}`)
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

    const savePath = instancePath ? join(instancePath, 'saves', saveName) : this.getPath('shared-saves', saveName)

    if (await missing(savePath)) {
      throw new InstanceSaveException({ type: 'instanceDeleteNoSave', name: saveName })
    }

    await rm(savePath, { recursive: true, force: true })
  }

  async shareSave(options: ShareSaveOptions): Promise<void> {
    const { instancePath, saveName } = options

    requireString(saveName)

    const savePath = join(instancePath, 'saves', saveName)

    if (await missing(savePath)) {
      throw new InstanceSaveException({ type: 'instanceDeleteNoSave', name: saveName })
    }

    await ensureDir(this.getPath('shared-saves'))
    let destSharedSavePath = this.getPath('shared-saves', saveName)

    if (await missing(destSharedSavePath)) {
      await rename(savePath, destSharedSavePath)
    } else {
      // move the save to shared save with a new name
      destSharedSavePath = this.getPath('shared-saves', `${saveName}-${Date.now()}`)
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
        throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path })
      }

      const sharedSavesDir = this.getPath('shared-saves')
      // if path is direct child of shared-saves, we need to link it else we copy it
      if (path.startsWith(sharedSavesDir)) {
        await createSymbolicLink(path, dest, this)
      } else {
        await copyPassively(path, dest)
      }
    } else {
      // validate the source
      const levelRoot = options.saveRoot
      if (!levelRoot) {
        throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path })
      }

      const zipFile = await open(path)
      const entries = await readAllEntries(zipFile)
      const task = new UnzipTask(zipFile, entries.filter(e => !e.fileName.endsWith('/')), dest, (e) => {
        return e.fileName.substring(levelRoot.length)
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
    const sharedSave = this.getPath('shared-saves')
    const instanceSave = join(instancePath, 'saves')
    const isLinked = await readlink(instanceSave).catch(() => '') === sharedSave
    return isLinked
  }

  async linkSharedSave(instancePath: string) {
    const sharedSave = this.getPath('shared-saves')
    const instanceSaves = join(instancePath, 'saves')
    await ensureDir(sharedSave)

    if (await readlink(instanceSaves).catch(() => '') === sharedSave) {
      return
    }

    if (await missing(instanceSaves)) {
      await createSymbolicLink(sharedSave, instanceSaves, this)
      return
    }

    // existed folder we need to merge to shared
    // move all saves to shared
    const saves = await readdir(instanceSaves)
    for (const saveName of saves) {
      const savePath = join(instanceSaves, saveName)
      // check if shared folder has the same save
      const sharedSavePath = join(sharedSave, saveName)
      const isLinked = await readlink(savePath).catch(() => '')

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
    await createSymbolicLink(sharedSave, instanceSaves, this)
  }

  async unlinkSharedSave(instancePath: string) {
    const sharedSave = this.getPath('shared-saves')
    const instanceSave = join(instancePath, 'saves')
    if (await readlink(instanceSave).catch(() => '') !== sharedSave) {
      return
    }

    await unlink(instanceSave)
    await ensureDir(instanceSave)
  }

  async getSharedSaves() {
    const sharedSave = this.getPath('shared-saves')
    const saves = await readdirIfPresent(sharedSave).then(a => a.filter(s => !s.startsWith('.')))
    const metadatas = Promise.all(saves
      .map(s => resolve(sharedSave, s))
      .map((p) => readInstanceSaveMetadata(p, '')))
    return metadatas
  }
}
