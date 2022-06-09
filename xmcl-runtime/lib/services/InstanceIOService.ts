import { checksum, MinecraftFolder } from '@xmcl/core'
import { createDefaultCurseforgeQuery, DownloadTask, UnzipTask } from '@xmcl/installer'
import { AnyPersistedResource, createTemplate, ExportInstanceOptions, InstanceIOException, InstanceIOService as IInstanceIOService, InstanceIOServiceKey, InstanceManifest, InstanceManifestSchema, InstanceSchema, InstanceUpdate, LockKey, RuntimeVersions, SetInstanceManifestOptions, InstanceFile, SourceInformation, ApplyInstanceUpdateOptions, GetManifestOptions } from '@xmcl/runtime-api'
import { BaseTask, Task, task } from '@xmcl/task'
import { open, readAllEntries } from '@xmcl/unzip'
import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { mkdtemp, readdir, readJson, remove, stat, unlink } from 'fs-extra'
import { Options } from 'got'
import { tmpdir } from 'os'
import { basename, join, relative, resolve } from 'path'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { copyPassively, exists, isDirectory, isFile, linkWithTimeoutOrCopy, missing, readdirIfPresent } from '../util/fs'
import { requireObject, requireString } from '../util/object'
import { isValidateUrl, joinUrl } from '../util/url'
import { ZipTask } from '../util/zip'
import { CurseForgeService } from './CurseForgeService'
import InstanceService from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { ModrinthService } from './ModrinthService'
import { PeerService } from './PeerService'
import { ResourceService } from './ResourceService'
import { AbstractService, Inject, Singleton } from './Service'
import { UserService } from './UserService'
import { VersionService } from './VersionService'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(PeerService) private peerService: PeerService,
    @Inject(UserService) private userService: UserService,
    @Inject(CurseForgeService) private curseForgeService: CurseForgeService,
    @Inject(ModrinthService) private modrinthService: ModrinthService,
  ) {
    super(app, InstanceIOServiceKey)
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
  async getInstanceManifest<T extends 'sha1' | 'sha256' | 'md5'>(options?: GetManifestOptions<T>): Promise<InstanceManifest<T>> {
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

    const files = [] as Array<InstanceFile<T>>

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
        const localFile: InstanceFile<T> = {
          path: relativePath,
          size: status.size,
          updateAt: status.mtimeMs,
          createAt: status.ctimeMs,
          hashes: {} as any,
        }
        if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks') || relativePath.startsWith('mods')) {
          let resource = this.resourceService.getResourceByKey(ino)
          const sha1 = resource?.hash ?? await this.worker().checksum(p, 'sha1')
          if (!resource) {
            resource = this.resourceService.getResourceByKey(sha1)
          }
          if (resource?.modrinth) {
            localFile.modrinth = {
              projectId: resource.modrinth.projectId,
              versionId: resource.modrinth.versionId,
            }
          }
          if (resource?.curseforge) {
            localFile.curseforge = {
              projectId: resource.curseforge.projectId,
              fileId: resource.curseforge.fileId,
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

  @Singleton((o) => o.path)
  async uploadInstanceManifest({ path, manifest, headers, includeFileWithDownloads, forceJsonFormat }: SetInstanceManifestOptions): Promise<void> {
    const instancePath = path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    if (!instance.fileApi) {
      throw new InstanceIOException({ instancePath, type: 'instanceHasNoFileApi' })
    }

    const url = isValidateUrl(instance.fileApi)
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https')) {
      throw new InstanceIOException({ instancePath, type: 'instanceInvalidFileApi', url: instance.fileApi })
    }

    const tempZipFile = join(this.app.temporaryPath, randomUUID())
    const useJson = forceJsonFormat || manifest.files.every(f => f.modrinth || f.curseforge || (f.downloads && f.downloads.length > 0))

    if (!useJson) {
      this.log(`Use zip to upload instance ${instancePath} to ${instance.fileApi}`)
      const task = new ZipTask(tempZipFile)

      for (const file of manifest.files) {
        const realPath = join(instancePath, file.path)
        const canBeDownload = file.modrinth || file.curseforge || (file.downloads && file.downloads.length > 0)
        if (includeFileWithDownloads || !canBeDownload) {
          task.addFile(realPath, file.path)
        }
      }

      task.addBuffer(Buffer.from(JSON.stringify(manifest), 'utf-8'), 'manifest.json')

      await task.startAndWait()
    } else {
      this.log(`Use json to upload instance ${instancePath} to ${instance.fileApi}`)
    }

    try {
      const start = Date.now()
      const allHeaders = headers ? { ...headers } : {}
      if (!allHeaders.Authorization && this.userService.state.user.msAccessToken) {
        allHeaders.Authorization = `Bearer ${this.userService.state.user.msAccessToken}`
      }

      allHeaders['content-type'] = useJson ? 'application/json' : 'application/zip'

      const res = await this.networkManager.request(instance.fileApi, {
        headers: allHeaders,
        body: useJson ? JSON.stringify(manifest) : createReadStream(tempZipFile),
        method: 'POST',
        throwHttpErrors: false,
      })

      if (res.statusCode !== 201) {
        this.error(`Fail to upload ${instancePath} to ${instance.fileApi} as server rejected. Status code: ${res.statusCode}, ${res.body}`)
        throw new InstanceIOException({ type: 'instanceSetManifestFailed', httpBody: res.body, statusCode: res.statusCode })
      }

      this.log(`Uploaded instance ${instancePath} to ${instance.fileApi}. Took ${Date.now() - start}ms.`)
    } finally {
      await unlink(tempZipFile).catch(() => undefined)
    }
  }

  @Singleton(p => p)
  async fetchInstanceUpdate(path?: string): Promise<InstanceUpdate | undefined> {
    const instancePath = path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance.fileApi) {
      return undefined
    }

    let manifest: InstanceManifestSchema
    try {
      manifest = await this.networkManager.request.get(instance.fileApi).json()
    } catch (e) {
      this.error(e)
      throw new InstanceIOException({
        type: 'instanceNotFoundInApi',
        url: instance.fileApi,
        statusCode: (e as any)?.response?.statusCode,
      })
    }

    const lookupFile = async (relativePath: string, hash: string, file: InstanceFile) => {
      const filePath = join(instancePath, relativePath)
      if (await missing(filePath)) {
        updates.push({
          file,
          operation: 'add',
        })
      } else {
        const sha1 = await checksum(filePath, 'sha1')
        if (sha1 !== hash) {
          updates.push({
            file,
            operation: 'update',
          })
        }
      }
    }

    const updates: InstanceUpdate['updates'] = []
    if (manifest.files) {
      for (const file of manifest.files) {
        await lookupFile(file.path, file.hashes.sha1, file)
        const fileApiUrl = joinUrl(instance.fileApi, file.path)
        if (file.downloads) {
          file.downloads.push(fileApiUrl)
        } else {
          file.downloads = [fileApiUrl]
        }
      }
    }
    return {
      updates,
      manifest,
    }
  }

  @Singleton((o) => o.path)
  async applyInstanceFilesUpdate(options: ApplyInstanceUpdateOptions): Promise<void> {
    const {
      path,
      updates,
    } = options

    const instancePath = path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    const { log, warn, error, peerService, resourceService, networkManager, curseForgeService, modrinthService } = this

    const createDownloadTask = (url: string[], dest: string, sha1: string) => new DownloadTask({
      ...networkManager.getDownloadBaseOptions(),
      url,
      destination: dest,
      validator: {
        hash: sha1,
        algorithm: 'sha1',
      },
    }).setName('file')

    const createFileLinkTask = (dest: string, res: AnyPersistedResource) => {
      return task('file', async () => {
        const fstat = await stat(dest).catch(() => undefined)
        if (fstat && fstat.ino === res.ino) {
          return
        }
        if (fstat) {
          // existed file
          await unlink(dest)
        }
        await linkWithTimeoutOrCopy(res.path, dest)
      })
    }
    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))

    const updateInstanceTask = task('updateInstance', async function () {
      await lock.write(async () => {
        const tasks: Task<any>[] = []
        for (const file of updates) {
          const sha1 = file.hashes.sha1
          const filePath = join(instancePath, file.path)
          const actualSha1 = await checksum(filePath, 'sha1').catch(() => undefined)

          if (relative(instancePath, filePath).startsWith('..')) {
            warn(`Skip to install the escaped file ${filePath}`)
            continue
          }

          if (actualSha1 === sha1) {
            // skip same file
            log(`Skip to update the file ${file.path} as the sha1 is matched`)
            continue
          }

          const resource = resourceService.state.mods.find(r => r.hash === sha1) || resourceService.state.resourcepacks.find(r => r.hash === sha1)
          if (resource) {
            log(`Link existed resource to ${filePath}`)
            tasks.push(createFileLinkTask(filePath, resource))
          } else {
            const urls = [] as string[]
            const source: SourceInformation = {}

            if (file.curseforge) {
              const fileInfo = await curseForgeService.fetchProjectFile(file.curseforge.projectId, file.curseforge.fileId)
              urls.unshift(fileInfo.downloadUrl)
              source.curseforge = {
                fileId: file.curseforge.fileId,
                projectId: file.curseforge.projectId,
              }
            }

            if (file.modrinth) {
              const version = await modrinthService.getProjectVersion(file.modrinth.versionId)
              source.modrinth = {
                filename: version.files[0].filename,
                versionId: file.modrinth.versionId,
                projectId: file.modrinth.projectId,
                url: version.files[0].url,
              }
              urls.unshift(version.files[0].url)
            }

            if (file.downloads) {
              const peerUrl = file.downloads.find(u => u.startsWith('peer://'))
              const hasHttp = file.downloads.some(u => u.startsWith('http'))
              if (peerUrl && !hasHttp) {
                // download from peer
                log(`Download ${filePath} from peer ${peerUrl}`)
                tasks.push(peerService.downloadTask(peerUrl, filePath, sha1, file.size).setName('file'))
                continue
              }
              urls.push(...file.downloads.filter(u => u.startsWith('http')))
            }

            if (Object.keys(source).length > 0) {
              resourceService.markResourceSource(sha1, source)
            }
            log(`Download ${filePath} from urls: [${urls.join(', ')}]`)
            const task = createDownloadTask(urls, filePath, sha1)
            tasks.push(task)
          }
        }
        await this.all(tasks)
      })
    })

    await this.submit(updateInstanceTask)
  }
}
