import { createHash } from 'crypto'
import filenamify from 'filenamify'
import { ensureDir, ensureFile, FSWatcher, readdir, remove } from 'fs-extra'
import watch from 'node-watch'
import { pathToFileURL } from 'url'
import { basename, extname, join, resolve } from 'path'
import AbstractService, { ExportService, ServiceException, Singleton, Subscribe } from './Service'
import { findLevelRootOnPath, getInstanceSave, readInstanceSaveMetadata } from '/@main/entities/save'
import { copyPassively, isFile, missing, readdirIfPresent } from '/@main/util/fs'
import { unpack7z, ZipTask } from '/@main/util/zip'
import { Exception } from '/@shared/entities/exception'
import { InstanceSave } from '/@shared/entities/save'
import {
  CloneSaveOptions, DeleteSaveOptions, ExportSaveOptions,
  ImportSaveOptions, InstanceSavesService as IInstanceSavesService, InstanceSavesServiceKey,
} from '/@shared/services/InstanceSavesService'
import { isNonnull, requireObject, requireString } from '/@shared/util/assert'

/**
 * Provide the ability to preview saves data of an instance
 */
@ExportService(InstanceSavesServiceKey)
export default class InstanceSavesService extends AbstractService implements IInstanceSavesService {
  private watcher: FSWatcher | undefined

  private watching = ''

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
  async getScreenshotUrls(path: string = this.state.instance.path) {
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

    for (const instance of this.getters.instances) {
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
        .map((p) => readInstanceSaveMetadata(p, this.getters.instance.name).catch((e) => {
          this.warn(`Parse save in ${p} failed. Skip it.`)
          this.warn(e)
          return undefined
        })))

      this.log(`Found ${saves.length} saves in instance ${path}`)
      this.commit('instanceSaves', saves.filter(isNonnull))
    } catch (e) {
      throw new ServiceException({ type: 'fsError', ...e }, `An error ocurred during parsing the save of ${path}`)
    }

    this.watching = savesDir
    this.watcher = watch(savesDir, (event, filename) => {
      if (filename.startsWith('.')) return
      const filePath = filename
      if (event === 'update') {
        if (this.state.instanceSave.saves.every((s) => s.path !== filename)) {
          readInstanceSaveMetadata(filePath, this.getters.instance.name).then((save) => {
            this.commit('instanceSaveAdd', save)
          }).catch((e) => {
            this.warn(`Parse save in ${filePath} failed. Skip it.`)
            this.warn(e)
            return undefined
          })
        }
      } else if (this.state.instanceSave.saves.some((s) => s.path === filename)) {
        this.commit('instanceSaveRemove', filePath)
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

    srcInstancePath = srcInstancePath ?? this.state.instance.path
    destInstancePath = destInstancePath ?? [this.state.instance.path]

    const destSaveName = newSaveName ?? saveName

    const destInstancePaths = typeof destInstancePath === 'string' ? [destInstancePath] : destInstancePath

    const srcSavePath = join(srcInstancePath, saveName)

    if (await missing(srcSavePath)) {
      throw new ServiceException({ type: 'instanceCopySaveNotFound', src: srcSavePath, dest: destInstancePaths }, `Cancel save copying of ${saveName}`)
    }
    if (!this.state.instance.all[srcInstancePath]) {
      throw new Error(`Cannot find managed instance ${srcInstancePath}`)
    }
    if (destInstancePaths.some(p => !this.state.instance.all[p])) {
      throw new Error(`Cannot find managed instance ${srcInstancePath}`)
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

    instancePath = instancePath ?? this.state.instance.path

    requireString(saveName)

    const savePath = join(instancePath, 'saves', saveName)

    if (await missing(savePath)) {
      throw new Exception({ type: 'instanceDeleteNoSave', name: saveName })
    }

    await remove(savePath)
  }

  async importSave(options: ImportSaveOptions) {
    let { source, instancePath, saveName } = options

    requireString(source)

    saveName = saveName ?? basename(source)
    instancePath = instancePath ?? this.state.instance.path

    if (!this.state.instance.all[instancePath]) {
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
      await unpack7z(source, sourceDir)
      useTemp = true
    }

    // validate the source
    const levelRoot = await findLevelRootOnPath(sourceDir)
    if (!levelRoot) {
      throw new Exception({ type: 'instanceImportIllegalSave', path: source })
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

    const { instancePath = this.state.instance.path, saveName, zip = true, destination } = options

    requireString(saveName)
    requireString(destination)

    const source = join(instancePath, saveName)

    if (!this.state.instance.all[instancePath]) {
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
