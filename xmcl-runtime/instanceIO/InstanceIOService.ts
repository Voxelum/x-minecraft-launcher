import { CreateInstanceOption, ExportInstanceOptions, InstanceIOService as IInstanceIOService, InstanceIOServiceKey, LockKey } from '@xmcl/runtime-api'
import { readFile } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, kGameDataPath, PathResolver, Inject } from '~/app'
import { kTaskExecutor, TaskFn } from '~/task'
import { copyPassively, exists } from '../util/fs'
import { requireObject } from '../util/object'
import { ZipTask } from '../util/zip'
import { InstanceService } from '~/instance'
import { AbstractService, ExposeServiceKey } from '~/service'
import { VersionService } from '~/version'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceIOServiceKey)
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(VersionService) private versionService: VersionService,
  ) {
    super(app)
  }

  /**
   * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
   * @param options The export instance options
   */
  async exportInstance(options: ExportInstanceOptions) {
    requireObject(options)

    const { src, destinationPath: dest, includeAssets = true, includeLibraries = true, files, includeVersionJar = true } = options

    // if (!this.instanceService.state.all[src]) {
    //   this.warn(`Cannot export unmanaged instance ${src}`)
    //   return
    // }

    const version = await this.versionService.resolveLocalVersion(options.version)

    const root = this.getPath()
    const from = src

    const zipTask = new ZipTask(dest).setName('modpack.export')

    const releases: Array<() => void> = []

    // add assets
    if (includeAssets) {
      releases.push(await this.semaphoreManager.getLock(LockKey.assets).acquireRead())
      const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`)
      zipTask.addFile(assetsJson, `assets/indexes/${version.assets}.json`)
      const objects = await readFile(assetsJson, 'utf8').then(JSON.parse).then(manifest => manifest.objects)
      for (const hash of Object.keys(objects).map(k => objects[k].hash)) {
        zipTask.addFile(resolve(root, 'assets', 'objects', hash.substring(0, 2), hash), `assets/objects/${hash.substring(0, 2)}/${hash}`)
      }
    }

    // add version json and jar
    const versionsChain = version.pathChain
    for (const versionPath of versionsChain) {
      const versionId = basename(versionPath)
      releases.push(await this.semaphoreManager.getLock(LockKey.version(versionId)).acquireRead())
      if (includeVersionJar && await exists(join(versionPath, `${versionId}.jar`))) {
        zipTask.addFile(join(versionPath, `${versionId}.jar`), `versions/${versionId}/${versionId}.jar`)
      }
      zipTask.addFile(join(versionPath, `${versionId}.json`), `versions/${versionId}/${versionId}.json`)
    }

    // add libraries
    if (includeLibraries) {
      releases.push(await this.semaphoreManager.getLock(LockKey.libraries).acquireRead())
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

    try {
      await this.submit(zipTask)
    } finally {
      releases.forEach(l => l())
    }
  }

  async importInstance(options: CreateInstanceOption & { importPath: string }) {
    const { importPath } = options

    const mcDir = importPath

    const instancePath = await this.instanceService.createInstance(options)

    await copyPassively(mcDir, instancePath, (v) => {
      if (v.endsWith('libraries')) {
        return false
      }
      if (v.endsWith('assets')) {
        return false
      }
      if (v.endsWith('versions')) {
        return false
      }
      return true
    })

    if (await exists(join(mcDir, 'libraries'))) {
      await copyPassively(join(mcDir, 'libraries'), this.getPath('libraries'))
    }
    if (await exists(join(mcDir, 'assets'))) {
      await copyPassively(join(mcDir, 'assets'), this.getPath('assets'))
    }
    if (await exists(join(mcDir, 'versions'))) {
      await copyPassively(join(mcDir, 'versions'), this.getPath('versions'))
    }

    return instancePath
    // const isDir = await isDirectory(location)

    // let srcDirectory = location
    // if (!isDir) {
    //   srcDirectory = await mkdtemp(join(tmpdir(), 'launcher'))
    //   const zipFile = await open(location)
    //   const entries = await readAllEntries(zipFile)
    //   const unzipTask = new UnzipTask(zipFile, entries, srcDirectory)
    //   await unzipTask.startAndWait()
    // }

    // // check if this game contains the instance.json from us
    // let instanceTemplate: InstanceSchema

    // const instanceConfigPath = resolve(srcDirectory, 'instance.json')
    // const isExportFromUs = await isFile(instanceConfigPath)
    // // if (isExportFromUs) {
    // //   instanceTemplate = await this.getPersistence({ path: instanceConfigPath, schema: InstanceSchema })
    // // } else {
    // // eslint-disable-next-line prefer-const
    // instanceTemplate = createTemplate()
    // instanceTemplate.creationDate = Date.now()

    // const dir = new MinecraftFolder(srcDirectory)
    // const versions = await readdir(dir.versions)
    // const localVersion: RuntimeVersions = {} as any
    // for (const ver of versions) {
    //   Object.assign(localVersion, await this.versionService.resolveLocalVersion(ver, dir.root))
    // }
    // delete localVersion.id
    // delete localVersion.folder
    // instanceTemplate.runtime = localVersion
    // instanceTemplate.name = basename(location)
    // }
  }
}
