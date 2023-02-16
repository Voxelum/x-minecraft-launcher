import { UnzipTask } from '@xmcl/installer'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  ImportSaveOptions, InstanceSave, InstanceSaveException, InstanceSavesService as IInstanceSavesService, InstanceSavesServiceKey, isSaveResource, ResourceDomain, SaveState,
} from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import filenamify from 'filenamify'
import { existsSync, FSWatcher } from 'fs'
import { ensureDir, ensureFile } from 'fs-extra/esm'
import { readdir, rm } from 'fs/promises'
import throttle from 'lodash.throttle'
import watch from 'node-watch'
import { basename, extname, join, resolve } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { findLevelRootOnPath, getInstanceSave, readInstanceSaveMetadata } from '../entities/save'
import { copyPassively, missing, readdirIfPresent } from '../util/fs'
import { isNonnull, requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ZipTask } from '../util/zip'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

/**
 * Provide the ability to preview saves data of an instance
 */
@ExposeServiceKey(InstanceSavesServiceKey)
export class InstanceSavesService extends StatefulService<SaveState> implements IInstanceSavesService {
  private watcher: FSWatcher | undefined

  private watching = ''

  private parking = false

  private pending: Set<string> = new Set()

  private updateSave = throttle((filePath: string) => {
    readInstanceSaveMetadata(filePath, this.instanceService.state.instance.name).then((save) => {
      this.state.instanceSaveUpdate(save)
    }).catch((e) => {
      this.warn(`Parse save in ${filePath} failed. Skip it.`)
      this.warn(e)
      return undefined
    })
  }, 2000)

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app, () => new SaveState())
    this.storeManager.subscribe('instanceSelect', (path) => {
      this.mountInstanceSaves(path)
    })

    this.storeManager.subscribe('launchCount', (count) => {
      const newState = count > 0
      if (newState !== this.parking) {
        for (const p of this.pending) {
          this.updateSave(p)
        }
        this.pending.clear()
      }
      this.parking = newState
    })

    this.resourceService.registerInstaller(ResourceDomain.Saves, async (resource, instancePath) => {
      if (isSaveResource(resource)) {
        await this.importSave({
          instancePath,
          path: resource.path,
          saveRoot: resource.metadata.save.root,
        })
      }
    })
  }

  async dispose() {
    if (this.watcher) {
      this.watcher.close()
    }
  }

  /**
   * Load all registered instances' saves metadata
   */
  @Singleton()
  async readAllInstancesSaves() {
    const all: Array<InstanceSave> = []

    for (const instance of this.instanceService.state.instances) {
      const saveRoot = join(instance.path, 'saves')
      const saves = await readdirIfPresent(saveRoot).then(a => a.filter(s => !s.startsWith('.')))
      const metadatas = saves
        .map(s => resolve(saveRoot, s))
        .map((p) => getInstanceSave(p, instance.name))
      all.push(...metadatas)
    }
    return all
  }

  /**
   * Mount and load instances saves
   * @param path
   */
  @Singleton()
  async mountInstanceSaves(path: string) {
    requireString(path)

    const savesDir = join(path, 'saves')

    if (this.watching === savesDir) {
      return
    }

    if (this.watcher) {
      this.watcher.close()
    }

    this.log(`Mount saves directory: ${savesDir}`)

    await ensureDir(savesDir)
    try {
      const savePaths = await readdir(savesDir)
      const saves = await Promise.all(savePaths
        .filter((d) => !d.startsWith('.'))
        .map((d) => join(savesDir, d))
        .map((p) => readInstanceSaveMetadata(p, this.instanceService.state.instance.name).catch((e) => {
          this.warn(`Parse save in ${p} failed. Skip it.`)
          this.warn(e)
          return undefined
        })))

      this.log(`Found ${saves.length} saves in instance ${path}`)
      this.state.instanceSaves(saves.filter(isNonnull))
    } catch (e) {
      // throw new GeneralException({ type: 'fsError', ...(e as any) }, `An error ocurred during parsing the save of ${path}`)
    }

    this.watching = savesDir
    this.watcher = watch(savesDir, (event, filename) => {
      if (filename.startsWith('.')) return
      const filePath = filename
      if (event === 'update') {
        if (this.state.saves.every((s) => s.path !== filename)) {
          if (!this.parking) {
            this.updateSave(filePath)
          } else {
            this.pending.add(filePath)
          }
        }
      } else if (this.state.saves.some((s) => s.path === filename)) {
        this.state.instanceSaveRemove(filePath)
      }
    })
  }

  /**
   * Clone a save under an instance to one or multiple instances.
   *
   * @param options
   */
  async cloneSave(options: CloneSaveOptions) {
    let { srcInstancePath, destInstancePath, saveName, newSaveName } = options

    requireString(saveName)

    srcInstancePath = srcInstancePath ?? this.instanceService.state.path
    destInstancePath = destInstancePath ?? [this.instanceService.state.path]

    const destSaveName = newSaveName ?? saveName

    const destInstancePaths = typeof destInstancePath === 'string' ? [destInstancePath] : destInstancePath

    const srcSavePath = join(srcInstancePath, saveName)

    if (await missing(srcSavePath)) {
      throw new InstanceSaveException({ type: 'instanceCopySaveNotFound', src: srcSavePath, dest: destInstancePaths },
        `Cancel save copying of ${saveName}`)
    }
    if (!this.instanceService.state.all[srcInstancePath]) {
      throw new InstanceSaveException({
        type: 'instanceNotFound',
        instancePath: srcInstancePath,
      }, `Cannot find managed instance ${srcInstancePath}`)
    }
    if (destInstancePaths.some(p => !this.instanceService.state.all[p])) {
      const notFound = destInstancePaths.find(p => !this.instanceService.state.all[p])!
      throw new InstanceSaveException({
        type: 'instanceNotFound',
        instancePath: notFound,
      }, `Cannot find managed instance ${notFound}`)
    }

    const destSavePaths = destInstancePaths.map(d => join(d, destSaveName))

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
    let { saveName, instancePath } = options

    instancePath = instancePath ?? this.instanceService.state.path

    requireString(saveName)

    const savePath = join(instancePath, 'saves', saveName)

    if (await missing(savePath)) {
      throw new InstanceSaveException({ type: 'instanceDeleteNoSave', name: saveName })
    }

    await rm(savePath, { recursive: true, force: true })
  }

  async importSave(options: ImportSaveOptions) {
    let { instancePath, saveName } = options

    instancePath = instancePath ?? this.instanceService.state.path

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
        throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path: path })
      }

      await copyPassively(options.directory, destinationDir)
    } else {
      // validate the source
      const levelRoot = options.saveRoot ?? await findLevelRootOnPath(path)
      if (!levelRoot) {
        throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path: path })
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

    const { instancePath = this.instanceService.state.path, saveName, zip = true, destination } = options

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
