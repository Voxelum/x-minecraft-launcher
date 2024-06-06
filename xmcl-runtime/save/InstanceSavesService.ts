import { UnzipTask } from '@xmcl/installer'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  InstanceSavesService as IInstanceSavesService,
  ImportSaveOptions,
  InstanceSaveException,
  InstanceSavesServiceKey,
  ResourceDomain, Saves,
  getInstanceSaveKey,
  isSaveResource,
} from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureDir, ensureFile, readdir, rm } from 'fs-extra'
import throttle from 'lodash.throttle'
import watch from 'node-watch'
import { basename, extname, join, resolve } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, missing, readdirIfPresent } from '../util/fs'
import { isNonnull, requireObject, requireString } from '../util/object'
import { ZipTask } from '../util/zip'
import { findLevelRootOnPath, getInstanceSave, readInstanceSaveMetadata } from './save'
import { LaunchService } from '~/launch'

/**
 * Provide the ability to preview saves data of an instance
 */
@ExposeServiceKey(InstanceSavesServiceKey)
export class InstanceSavesService extends AbstractService implements IInstanceSavesService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
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

      await ensureDir(savesDir)
      const watcher = watch(savesDir, (event, filename) => {
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
      })

      this.log(`Watch saves directory: ${savesDir}`)

      await ensureDir(savesDir)

      launchService.on('minecraft-start', onLaunch)
      launchService.on('minecraft-exit', onExit)
      const savePaths = await readdir(savesDir)
      const saves = await Promise.all(savePaths
        .filter((d) => !d.startsWith('.'))
        .map((d) => join(savesDir, d))
        .map((p) => readInstanceSaveMetadata(p, baseName).catch((e) => {
          this.warn(`Parse save in ${p} failed. Skip it.`)
          this.warn(e)
          return undefined
        })))

      this.log(`Found ${saves.length} saves in instance ${path}`)
      state.saves = saves.filter(isNonnull)

      return [state, () => {
        watcher.close()
        launchService.off('minecraft-start', onLaunch)
        launchService.off('minecraft-exit', onExit)
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
}
