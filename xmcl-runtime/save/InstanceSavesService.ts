import { UnzipTask } from '@xmcl/installer'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  getInstanceSaveKey,
  InstanceSavesService as IInstanceSavesService,
  ImportSaveOptions,
  InstanceSaveException,
  InstanceSavesServiceKey,
  isSaveResource,
  LinkSaveAsServerWorldOptions,
  ResourceDomain, Saves,
} from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureDir, ensureFile, readdir, readlink, rename, rm, unlink } from 'fs-extra'
import throttle from 'lodash.throttle'
import watch from 'node-watch'
import { basename, extname, isAbsolute, join, resolve } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, PathResolver } from '~/app'
import { InstanceService } from '~/instance'
import { LaunchService } from '~/launch'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { isSystemError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, createSymbolicLink, missing, readdirIfPresent } from '../util/fs'
import { isNonnull, requireObject, requireString } from '../util/object'
import { ZipTask } from '../util/zip'
import { findLevelRootOnPath, getInstanceSave, readInstanceSaveMetadata } from './save'

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
    const metadatas = saves
      .map(s => resolve(saveRoot, s))
      .map((p) => getInstanceSave(p, baseName))
    return metadatas
  }

  /**
   * Mount and load instances saves
   * @param path
   */
  async watch(path: string) {
    requireString(path)

    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getInstanceSaveKey(path), async ({ defineAsyncOperation }) => {
      const pending: Set<string> = new Set()
      const baseName = basename(path)
      const savesDir = join(path, 'saves')
      let parking = false
      const state = new Saves()
      const launchService = await this.app.registry.get(LaunchService)

      const updateSave = throttle(defineAsyncOperation((filePath: string) => {
        return readInstanceSaveMetadata(filePath, baseName).then((save) => {
          state.instanceSaveUpdate(save)
        }).catch((e) => {
          this.warn(`Parse save in ${filePath} failed. Skip it.`)
          this.warn(e)
          return undefined
        })
      }), 2000)

      let count = 0
      const onUpdate = () => {
        const newState = count > 0
        if (newState !== parking) {
          for (const p of pending) {
            updateSave(p)
          }
          pending.clear()
        }
        parking = newState
      }
      const onLaunch = () => {
        count++
        onUpdate()
      }
      const onExit = () => {
        count--
        onUpdate()
      }
      launchService.on('minecraft-start', onLaunch)
      launchService.on('minecraft-exit', onExit)

      await ensureDir(savesDir)
      const link = await readlink(savesDir).catch(() => '')

      let isLinked = !!link
      const onFileUpdate = (event: 'update' | 'remove', filename: string) => {
        if (filename.startsWith('.')) return
        const filePath = filename
        if (event === 'update') {
          if (state.saves.every((s) => s.path !== filename)) {
            if (!parking) {
              updateSave(filePath)
            } else {
              pending.add(filePath)
            }
          }
        } else if (state.saves.some((s) => s.path === filename)) {
          state.instanceSaveRemove(filePath)
        }
      }
      let watcher = watch(savesDir, onFileUpdate)

      this.log(`Watch saves directory: ${savesDir}`)

      const readAll = async () => {
        const savePaths = await readdir(savesDir)
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

      const saves = await readAll()
      this.log(`Found ${saves.length} saves in instance ${path}`)
      state.saves = saves

      return [state, () => {
        watcher.close()
        launchService.off('minecraft-start', onLaunch)
        launchService.off('minecraft-exit', onExit)
      }, async () => {
        const newIsLink = !!await readlink(savesDir).catch(() => '')
        if (newIsLink !== isLinked) {
          isLinked = !!newIsLink
          watcher = watch(savesDir, onUpdate)
          const saves = await readAll()
          state.instanceSaves(saves)
        }
      }]
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

    const savePath = join(instancePath, 'saves', saveName)

    if (await missing(savePath)) {
      throw new InstanceSaveException({ type: 'instanceDeleteNoSave', name: saveName })
    }

    await rm(savePath, { recursive: true, force: true })
  }

  async importSave(options: ImportSaveOptions) {
    let { instancePath, saveName } = options

    if (!this.instanceService.state.all[instancePath]) {
      throw new Error(`Cannot find managed instance ${instancePath}`)
    }

    const path = 'directory' in options ? options.directory : options.path
    // normalize the save name
    saveName = saveName ?? basename(path)
    saveName = filenamify(saveName)
    const destinationDir = join(instancePath, 'saves', basename(saveName, extname(saveName)))

    if ('directory' in options) {
      if (!existsSync(join(path, 'level.dat'))) {
        throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path })
      }

      await copyPassively(options.directory, destinationDir)
    } else {
      // validate the source
      const levelRoot = options.saveRoot ?? await findLevelRootOnPath(path)
      if (!levelRoot) {
        throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path })
      }

      const zipFile = await open(path)
      const entries = await readAllEntries(zipFile)
      const task = new UnzipTask(zipFile, entries.filter(e => !e.fileName.endsWith('/')), destinationDir, (e) => {
        return e.fileName.substring(levelRoot.length)
      })
      await task.startAndWait()
    }

    return destinationDir
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
    const instanceSave = join(instancePath, 'saves')
    await ensureDir(sharedSave)

    if (await readlink(instanceSave).catch(() => '') === sharedSave) {
      return
    }

    if (await missing(instanceSave)) {
      await createSymbolicLink(sharedSave, instanceSave, this)
      return
    }

    // existed folder we need to merge to shared
    // move all saves to shared
    const saves = await readdir(instanceSave)
    for (const saveName of saves) {
      // check if shared folder has the same save
      const sharedSavePath = join(sharedSave, saveName)
      if (await missing(sharedSavePath)) {
        await rename(join(instanceSave, saveName), sharedSavePath)
      } else {
        // move to shared with a new name
        const newName = `${saveName}-${Date.now()}`
        await rename(join(instanceSave, saveName), join(sharedSave, newName))
      }
    }

    await rm(instanceSave, { recursive: true })
    await createSymbolicLink(sharedSave, instanceSave, this)
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
    const metadatas = saves
      .map(s => resolve(sharedSave, s))
      .map((p) => getInstanceSave(p, ''))
    return metadatas
  }
}
