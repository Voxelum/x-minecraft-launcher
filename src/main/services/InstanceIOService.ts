import { MinecraftFolder } from '@xmcl/core'
import { UnzipTask } from '@xmcl/installer'
import { open, readAllEntries } from '@xmcl/unzip'
import { mkdtemp, readdir, readJson, remove, stat } from 'fs-extra'
import { tmpdir } from 'os'
import { basename, join, relative, resolve } from 'path'
import LauncherApp from '../app/LauncherApp'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, Singleton } from './Service'
import VersionService from './VersionService'
import { copyPassively, exists, isDirectory, isFile, readdirIfPresent } from '/@main/util/fs'
import { ZipTask } from '/@main/util/zip'
import { createTemplate } from '/@shared/entities/instance'
import { InstanceSchema, RuntimeVersions } from '/@shared/entities/instance.schema'
import { ExportInstanceOptions, InstanceFile, InstanceIOService as IInstanceIOService, InstanceIOServiceKey } from '/@shared/services/InstanceIOService'
import { requireObject, requireString } from '/@shared/util/assert'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExportService(InstanceIOServiceKey)
export default class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
  ) {
    super(app)
  }

  /**
   * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
   * @param options The export instance options
   */
  @Singleton('instance')
  async exportInstance(options: ExportInstanceOptions) {
    requireObject(options)

    const { src = this.state.instance.path, destinationPath: dest, includeAssets = true, includeLibraries = true, files, includeVersionJar = true } = options

    if (!this.state.instance.all[src]) {
      this.warn(`Cannot export unmanaged instance ${src}`)
      return
    }

    const version = this.getters.instanceVersion

    if (version.id === '') {
      // TODO: throw
      this.warn(`Cannot export instance ${src} as its version is not installed!`)
      return
    }

    const root = this.getPath()
    const from = src

    const zipTask = new ZipTask(dest).setName('profile.modpack.export')

    // add assets
    if (includeAssets) {
      const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`)
      zipTask.addFile(assetsJson, `assets/indexes/${version.assets}.json`)
      const objects = await readJson(assetsJson).then(manifest => manifest.objects)
      for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
        zipTask.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`)
      }
    }

    // add version json and jar
    const verionsChain = version.pathChain
    for (const versionPath of verionsChain) {
      const versionId = basename(versionPath)
      if (includeVersionJar && await exists(join(versionPath, `${versionId}.jar`))) {
        zipTask.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`)
      }
      zipTask.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`)
    }

    // add libraries
    if (includeLibraries) {
      for (const lib of version.libraries) {
        zipTask.addFile(resolve(root, 'libraries', lib.download.path),
          `libraries/${lib.download.path}`)
      }
    }

    // add misc files like config, log...
    if (files) {
      for (const file of files) {
        zipTask.addFile(join(src, file), file)
      }
    } else {
      await zipTask.includeAs(from, '')
    }

    await this.submit(zipTask)
  }

  /**
   * Scan all the files under the current instance.
   * It will hint if a mod resource is in curseforge
   */
  async getInstanceFiles(): Promise<InstanceFile[]> {
    const path = this.state.instance.path
    const files = [] as InstanceFile[]

    const scan = async (p: string) => {
      const status = await stat(p)
      const ino = status.ino
      const isDirectory = status.isDirectory()
      const isResource = !!this.resourceService.getResourceByKey(ino)?.curseforge
      files.push({ isDirectory, path: relative(path, p).replace(/\\/g, '/'), isResource })
      if (isDirectory) {
        const childs = await readdirIfPresent(p)
        for (const child of childs) {
          await scan(join(p, child))
        }
      }
    }

    await scan(path)
    files.shift()

    return files
  }

  /**
   * Link a existed instance on you disk.
   * @param path
   */
  async linkInstance(path: string) {
    if (this.state.instance.all[path]) {
      this.log(`Skip to link already managed instance ${path}`)
      return false
    }
    const loaded = await this.instanceService.loadInstance(path)
    if (!loaded) {
      await this.instanceService.createInstance({ path })
    }

    // copy assets, library and versions
    await copyPassively(resolve(path, 'assets'), this.getPath('assets'))
    await copyPassively(resolve(path, 'libraries'), this.getPath('libraries'))
    await copyPassively(resolve(path, 'versions'), this.getPath('versions'))

    return true
  }

  async importInstance(location: string) {
    requireString(location)

    const isDir = await isDirectory(location)

    let srcDirectory = location
    if (!isDir) {
      srcDirectory = await mkdtemp(join(tmpdir(), 'launcher'))
      const zipFile = await open(location)
      const entries = await readAllEntries(zipFile)
      const unzipTask = new UnzipTask(zipFile, entries, srcDirectory)
      await unzipTask.startAndWait()
    }

    // check if this game contains the instance.json from us
    let instanceTemplate: InstanceSchema

    const instanceConfigPath = resolve(srcDirectory, 'instance.json')
    const isExportFromUs = await isFile(instanceConfigPath)
    // if (isExportFromUs) {
    //   instanceTemplate = await this.getPersistence({ path: instanceConfigPath, schema: InstanceSchema })
    // } else {
    // eslint-disable-next-line prefer-const
    instanceTemplate = createTemplate()
    instanceTemplate.creationDate = Date.now()

    const dir = new MinecraftFolder(srcDirectory)
    const versions = await readdir(dir.versions)
    const localVersion: RuntimeVersions = {} as any
    for (const ver of versions) {
      Object.assign(localVersion, await this.versionService.resolveLocalVersion(ver, dir.root))
    }
    delete localVersion.id
    delete localVersion.folder
    instanceTemplate.runtime = localVersion
    instanceTemplate.name = basename(location)
    // }

    // create instance
    const instancePath = await this.instanceService.createInstance(instanceTemplate)

    // start copy from src to instance
    await copyPassively(srcDirectory, instancePath, (path) => {
      if (path.endsWith('/versions')) return false
      if (path.endsWith('/assets')) return false
      if (path.endsWith('/libraries')) return false
      return true
    })

    // copy assets, library and versions
    await copyPassively(resolve(srcDirectory, 'assets'), this.getPath('assets'))
    await copyPassively(resolve(srcDirectory, 'libraries'), this.getPath('libraries'))
    await copyPassively(resolve(srcDirectory, 'versions'), this.getPath('versions'))

    if (!isDir) { await remove(srcDirectory) }

    return instancePath
  }
}
