import { checksum, MinecraftFolder } from '@xmcl/core'
import { createDefaultCurseforgeQuery, DownloadTask, UnzipTask } from '@xmcl/installer'
import { AnyPersistedResource, createTemplate, ExportInstanceOptions, InstanceFile, InstanceFileCurseforge, InstanceFileModrinth, InstanceFileUrl, InstanceIOService as IInstanceIOService, InstanceIOServiceKey, InstanceManifest, InstanceSchema, InstanceUpdate, LockKey, RuntimeVersions } from '@xmcl/runtime-api'
import { BaseTask, task } from '@xmcl/task'
import { open, readAllEntries } from '@xmcl/unzip'
import { mkdtemp, readdir, readJson, remove, stat, unlink } from 'fs-extra'
import { tmpdir } from 'os'
import { basename, join, relative, resolve } from 'path'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { copyPassively, exists, isDirectory, isFile, linkWithTimeoutOrCopy, missing, readdirIfPresent } from '../util/fs'
import { requireObject, requireString } from '../util/object'
import { ZipTask } from '../util/zip'
import InstanceService from './InstanceService'
import { InstanceVersionService } from './InstanceVersionService'
import { ResourceService } from './ResourceService'
import { AbstractService, Inject, Lock, Singleton } from './Service'
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

    const version = this.instanceVersionService.getInstanceVersion()

    if (version.id === '') {
      // TODO: throw
      this.emit('error', {
        type: '',
      })
      this.warn(`Cannot export instance ${src} as its version is not installed!`)
      return
    }

    const root = this.getPath()
    const from = src

    const zipTask = new ZipTask(dest).setName('profile.modpack.export')

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

  /**
   * Scan all the files under the current instance.
   * It will hint if a mod resource is in curseforge
   */
  async getInstanceFiles(): Promise<InstanceFile[]> {
    const path = this.instanceService.state.path
    const files = [] as InstanceFile[]

    const scan = async (p: string) => {
      const status = await stat(p)
      const ino = status.ino
      const isDirectory = status.isDirectory()
      const sources: Array<'modrinth' | 'curseforge'> = []
      const resource = this.resourceService.getResourceByKey(ino)
      if (resource?.curseforge) {
        sources.push('curseforge')
      }
      if (resource?.modrinth) {
        sources.push('modrinth')
      }
      const relativePath = relative(path, p).replace(/\\/g, '/')
      if (relativePath.startsWith('resourcepacks') || relativePath.startsWith('shaderpacks')) {
        if (relativePath.endsWith('.json') || relativePath.endsWith('.png')) {
          return
        }
      }
      if (relativePath === 'instance.json') {
        return
      }
      files.push({
        isDirectory,
        path: relativePath,
        sources,
        size: status.size,
        updateAt: status.mtimeMs,
        createAt: status.ctimeMs,
      })
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
    if (this.instanceService.state.all[path]) {
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

  @Singleton()
  async getInstanceUpdate(path?: string): Promise<InstanceUpdate | undefined> {
    const instancePath = path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance.fileApi) {
      return undefined
    }

    const manifest: InstanceManifest = await this.networkManager.request.get(instance.fileApi).json()
    const lookupFile = async (relativePath: string, hash: string, file: InstanceFileCurseforge | InstanceFileModrinth | InstanceFileUrl) => {
      const filePath = join(path!, relativePath)
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
        if (file.type === 'addon') {
          await lookupFile(file.path, file.hash, file)
        } else if (file.type === 'curse') {
          if (file.path && file.hash) {
            await lookupFile(file.path, file.hash, file)
          } else {
            if (!this.resourceService.getExistedCurseforgeResource(file.projectID, file.fileID)) {
              updates.push({
                file,
                operation: 'add',
              })
            }
          }
        } else if (file.type === 'modrinth') {
          if (file.path && file.hash) {
            await lookupFile(file.path, file.hash, file)
          } else {
            if (!this.resourceService.getExistedModrinthResource(file.projectId, file.versionId)) {
              updates.push({
                file,
                operation: 'update',
              })
            }
          }
        }
      }
    }
    return {
      updates,
      manifest,
    }
  }

  @Singleton((o) => o.path)
  async applyInstanceUpdate(options: {
    path: string
    updates: Array<InstanceFileCurseforge | InstanceFileUrl | InstanceFileModrinth>
  }): Promise<void> {
    const {
      path: instancePath,
      updates,
    } = options

    const instance = this.instanceService.state.all[instancePath]

    if (!instance) {
      throw new Error(`Instance not found ${instancePath}`)
    }

    const networkManager = this.networkManager
    const resourceService = this.resourceService
    const { log, warn, error } = this

    const updateInstanceTask = task('updateInstance', async function () {
      const fileDownloadDownloadTask = (url: string, dest: string, sha1: string) => {
        return new DownloadTask({
          ...networkManager.getDownloadBaseOptions(),
          url,
          destination: dest,
          validator: {
            hash: sha1,
            algorithm: 'sha1',
          },
        }).setName('file')
      }
      const fileLinkTask = (dest: string, res: AnyPersistedResource) => {
        return task('file', async () => {
          const fstat = await stat(dest).catch(() => undefined)
          if (fstat && fstat.ino === res.ino) {
            return
          }
          const sha1 = await checksum(dest, 'sha1').catch(() => undefined)
          if (sha1 === res.hash) {
            return
          }
          if (fstat) {
            // existed file
            await unlink(dest)
          }
          await linkWithTimeoutOrCopy(res.path, dest)
        })
      }
      const getCurseforgeUrl = createDefaultCurseforgeQuery(networkManager.agents.https)
      const isValidateUrl = (url: string) => {
        try {
          // eslint-disable-next-line no-new
          new URL(url)
          return true
        } catch (e) {
          return false
        }
      }
      const ensureDownloadUrl = async (proj: number, file: number) => {
        for (let i = 0; i < 3; ++i) {
          const result = await getCurseforgeUrl(proj, file)
          if (isValidateUrl(result)) {
            return result
          }
        }
        throw new Error(`Fail to ensure curseforge url ${proj}, ${file}`)
      }
      const curseforgeDownloadDownloadTask = async (p: number, f: number, path?: string, sha1?: string) => {
        const url = await ensureDownloadUrl(p, f)
        const destination = path || join(instancePath, basename(url))
        return new DownloadTask({
          ...networkManager.getDownloadBaseOptions(),
          url,
          destination,
          validator: sha1
            ? {
              hash: sha1,
              algorithm: 'sha1',
            }
            : undefined,
        }).setName('file')
      }

      const tasks: BaseTask<any>[] = []
      for (const file of updates) {
        if (file.path && file.hash && 'url' in file) {
          const filePath = join(instancePath, file.path)
          if (relative(instancePath, filePath).startsWith('..')) {
            warn(`Skip to install the escaped file ${filePath}`)
            continue
          }
          const res = resourceService.state.mods.find(r => r.hash === file.hash) || resourceService.state.resourcepacks.find(r => r.hash === file.hash)
          if (res) {
            tasks.push(fileLinkTask(filePath, res))
          } else {
            tasks.push(fileDownloadDownloadTask(file.url, filePath, file.hash))
          }
        } else if (file.type === 'curse') {
          const res = resourceService.state.mods.find(r => r.hash === file.hash ||
            (r.curseforge && r.curseforge.projectId === file.projectID && r.curseforge.fileId === file.fileID)) ||
            resourceService.state.resourcepacks.find(r => r.hash === file.hash ||
              (r.curseforge && r.curseforge.projectId === file.projectID && r.curseforge.fileId === file.fileID))
          if (res) {
            const filePath = file.path ? join(instancePath, file.path) : join(instancePath, res.domain, res.fileName + res.ext)
            if (relative(instancePath, filePath).startsWith('..')) {
              warn(`Skip to install the escaped file ${filePath}`)
              continue
            }
            tasks.push(fileLinkTask(filePath, res))
          } else {
            tasks.push(await curseforgeDownloadDownloadTask(file.projectID, file.fileID, file.path ? join(instancePath, file.path) : undefined, file.hash))
          }
        }
      }

      await this.all(tasks)
    })

    await this.submit(updateInstanceTask)
  }
}
