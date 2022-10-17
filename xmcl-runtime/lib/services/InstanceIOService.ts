import { MinecraftFolder } from '@xmcl/core'
import { UnzipTask } from '@xmcl/installer'
import { createTemplate, ExportInstanceOptions, GetManifestOptions, InstanceFile, InstanceIOException, InstanceIOService as IInstanceIOService, InstanceIOServiceKey, InstanceManifest, InstanceSchema, LockKey, RuntimeVersions } from '@xmcl/runtime-api'
import { open, readAllEntries } from '@xmcl/unzip'
import { mkdtemp, readdir, readJson, remove, stat } from 'fs-extra'
import { tmpdir } from 'os'
import { basename, join, relative, resolve } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { copyPassively, exists, isDirectory, isFile, readdirIfPresent } from '../util/fs'
import { requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ZipTask } from '../util/zip'
import { InstanceService } from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'
import { VersionService } from './VersionService'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceIOServiceKey)
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
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

    const { src = this.instanceService.state.path, destinationPath: dest, includeAssets = true, includeLibraries = true, files, includeVersionJar = true } = options

    if (!this.instanceService.state.all[src]) {
      this.warn(`Cannot export unmanaged instance ${src}`)
      return
    }

    const version = this.instanceVersionService.state.version

    if (!version) {
      // TODO: throw
      this.emit('error', {
        type: '',
      })
      this.warn(`Cannot export instance ${src} as its version is not installed!`)
      return
    }

    const root = this.getPath()
    const from = src

    const zipTask = new ZipTask(dest).setName('modpack.export')

    const releases: Array<() => void> = []

    // add assets
    if (includeAssets) {
      releases.push(await this.semaphoreManager.getLock(LockKey.assets).acquireRead())
      const assetsJson = resolve(root, 'assets', 'indexes', `${version.assets}.json`)
      zipTask.addFile(assetsJson, `assets/indexes/${version.assets}.json`)
      const objects = await readJson(assetsJson).then(manifest => manifest.objects)
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

  @Singleton(p => p)
  async getInstanceManifest(options?: GetManifestOptions): Promise<InstanceManifest> {
    const instancePath = options?.path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    const resolveHashes = async (file: string, sha1: string) => {
      const result: Record<string, string> = { sha1 }
      if (options?.hashes) {
        for (const hash of options.hashes) {
          if (hash === 'sha1') {
            continue
          } else {
            result[hash] = await this.worker().checksum(file, hash)
          }
        }
      }
      return result as any
    }

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    const files = [] as Array<InstanceFile>

    const scan = async (p: string) => {
      const status = await stat(p)
      const ino = status.ino
      const isDirectory = status.isDirectory()
      const relativePath = relative(instancePath, p).replace(/\\/g, '/')
      if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
        if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
          return
        }
      }
      if (relativePath === 'instance.json') {
        return
      }
      // no lib or exe
      if (relativePath.endsWith('.dll') || relativePath.endsWith('.so') || relativePath.endsWith('.exe')) {
        return
      }
      // do not share versions/libs/assets
      if (relativePath.startsWith('versions') || relativePath.startsWith('assets') || relativePath.startsWith('libraries')) {
        return
      }

      if (isDirectory) {
        const children = await readdirIfPresent(p)
        await Promise.all(children.map(child => scan(join(p, child))))
      } else {
        const localFile: InstanceFile = {
          path: relativePath,
          size: status.size,
          hashes: {},
        }
        if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks') || relativePath.startsWith('mods')) {
          let resource = this.resourceService.getResourceByKey(ino)
          const sha1 = resource?.hash ?? await this.worker().checksum(p, 'sha1')
          if (!resource) {
            resource = this.resourceService.getResourceByKey(sha1)
          }
          if (resource?.metadata.modrinth) {
            localFile.modrinth = {
              projectId: resource.metadata.modrinth.projectId,
              versionId: resource.metadata.modrinth.versionId,
            }
          }
          if (resource?.metadata.curseforge) {
            localFile.curseforge = {
              projectId: resource.metadata.curseforge.projectId,
              fileId: resource.metadata.curseforge.fileId,
            }
          }
          localFile.downloads = resource?.uri && resource.uri.some(u => u.startsWith('http')) ? resource.uri.filter(u => u.startsWith('http')) : undefined
          localFile.hashes = await resolveHashes(p, sha1)
        }

        files.push(localFile)
      }
    }

    await scan(instancePath)
    files.shift()

    return {
      files,
      mcOptions: instance.mcOptions,
      vmOptions: instance.vmOptions,
      runtime: instance.runtime,
      maxMemory: instance.maxMemory,
      minMemory: instance.minMemory,
    }
  }
}
