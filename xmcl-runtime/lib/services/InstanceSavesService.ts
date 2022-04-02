import { UnzipTask } from '@xmcl/installer'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  GeneralException,
  ImportSaveOptions, InstanceSave, InstanceSaveException, InstanceSavesService as IInstanceSavesService, InstanceSavesServiceKey, SaveState,
} from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import { createHash } from 'crypto'
import filenamify from 'filenamify'
import { ensureDir, ensureFile, FSWatcher, readdir, remove } from 'fs-extra'
import watch from 'node-watch'
import { basename, extname, join, resolve } from 'path'
import { pathToFileURL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { findLevelRootOnPath, getInstanceSave, readInstanceSaveMetadata } from '../entities/save'
import { copyPassively, isFile, missing, readdirIfPresent } from '../util/fs'
import { isNonnull, requireObject, requireString } from '../util/object'
import { ZipTask } from '../util/zip'
import InstanceService from './InstanceService'
import { ExportService, Inject, Singleton, StatefulService, Subscribe } from './Service'

/**
 * Provide the ability to preview saves data of an instance
 */
@ExportService(InstanceSavesServiceKey)
export default class InstanceSavesService extends StatefulService<SaveState> implements IInstanceSavesService {
  createState() { return new SaveState() }

  private watcher: FSWatcher | undefined

  private watching = ''

  constructor(app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService) {
    super(app)
  }

  async dispose() {
    if (this.watcher) {
      this.watcher.close()
    }
  }

  /**
   * Return the instance's screenshots urls.
   *
   * If the provided path is not a instance, it will return empty array.
   */
  async getScreenshotUrls(path: string = this.instanceService.state.path) {
    const screenshots = join(path, 'screenshots')
    try {
      const files = await readdir(screenshots)
      return files.map(f => pathToFileURL(join(path, 'screenshots')).toString())
    } catch (e) {
      return []
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

  @Subscribe('instanceSelect')
  protected onInstance(payload: string) {
    this.mountInstanceSaves(payload)
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
      throw new GeneralException({ type: 'fsError', ...(e as any) }, `An error ocurred during parsing the save of ${path}`)
    }

    this.watching = savesDir
    this.watcher = watch(savesDir, (event, filename) => {
      if (filename.startsWith('.')) return
      const filePath = filename
      if (event === 'update') {
        if (this.state.saves.every((s) => s.path !== filename)) {
          readInstanceSaveMetadata(filePath, this.instanceService.state.instance.name).then((save) => {
            this.state.instanceSaveAdd(save)
          }).catch((e) => {
            this.warn(`Parse save in ${filePath} failed. Skip it.`)
            this.warn(e)
            return undefined
          })
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

    await remove(savePath)
  }

  async importSave(options: ImportSaveOptions) {
    let { source, instancePath, saveName } = options

    requireString(source)

    saveName = saveName ?? basename(source)
    instancePath = instancePath ?? this.instanceService.state.path

    if (!this.instanceService.state.all[instancePath]) {
      throw new Error(`Cannot find managed instance ${instancePath}`)
    }

    // normalize the save name
    saveName = filenamify(saveName)

    let sourceDir = source
    const destinationDir = join(instancePath, 'saves', basename(saveName, extname(saveName)))
    let useTemp = false

    if (await isFile(source)) {
      const hash = createHash('sha1').update(source).digest('hex')
      sourceDir = join(this.app.temporaryPath, hash) // save will unzip to the /saves
      const zipFile = await open(source)
      const entries = await readAllEntries(zipFile)
      const task = new UnzipTask(zipFile, entries, sourceDir)
      await task.startAndWait()
      useTemp = true
    }

    // validate the source
    const levelRoot = await findLevelRootOnPath(sourceDir)
    if (!levelRoot) {
      throw new InstanceSaveException({ type: 'instanceImportIllegalSave', path: source })
    }

    await copyPassively(levelRoot, destinationDir)

    if (useTemp) {
      await remove(sourceDir)
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
