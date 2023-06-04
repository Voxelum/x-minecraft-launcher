import { CurseforgeV1Client } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceInstallService as IInstanceInstallService, InstallInstanceOptions, InstanceFile, InstanceFileWithOperation, InstanceIOException, InstanceInstallServiceKey, LockKey, Resource, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { AbortableTask, task } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { writeFile } from 'atomically'
import { createWriteStream, existsSync } from 'fs'
import { ensureFile } from 'fs-extra/esm'
import { readFile, rename, stat, unlink } from 'fs/promises'
import { join, relative } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { errors } from 'undici'
import { Entry, ZipFile } from 'yauzl'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { ResourceWorker, kResourceWorker } from '../entities/resourceWorker'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createPromiseSignal } from '../util/promiseSignal'
import { CurseForgeService } from './CurseForgeService'
import { InstanceService } from './InstanceService'
import { ModrinthService } from './ModrinthService'
import { PeerService } from './PeerService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

type RequiredPick<T, K extends keyof T> = T & Required<Pick<T, K>>

export class ResolveInstanceFileTask extends AbortableTask<void> {
  private controller?: AbortController

  constructor(private files: InstanceFile[], private curseforgeClient: CurseforgeV1Client, private modrinthClient: ModrinthV2Client) {
    super()
    this.name = 'resolve'
  }

  protected async process(): Promise<void> {
    const curseforgeProjects = [] as RequiredPick<InstanceFile, 'curseforge'>[]
    const modrinthProjects = [] as RequiredPick<InstanceFile, 'modrinth'>[]
    const modrinthFileHashProjects = [] as InstanceFile[]
    for (const file of this.files) {
      if (file.path.startsWith('resourcepacks') || file.path.startsWith('shaderpacks') || file.path.startsWith('mods')) {
        if (file.curseforge) {
          curseforgeProjects.push(file as any)
        }

        if (file.modrinth) {
          modrinthProjects.push(file as any)
        }

        if (!file.modrinth && !file.curseforge) {
          modrinthFileHashProjects.push(file)
        }
      }
    }

    const controller = new AbortController()
    this.controller = controller

    const processCurseforge = async () => {
      if (curseforgeProjects.length === 0) return
      const result = await this.curseforgeClient.getFiles(curseforgeProjects.map(p => p.curseforge.fileId), controller.signal)
      for (const r of result) {
        const p = curseforgeProjects.find(p => p.curseforge.fileId === r.id)!
        if (!p.downloads) { p.downloads = [] }
        const url = r.downloadUrl ? [r.downloadUrl] : guessCurseforgeFileUrl(r.id, r.fileName)
        p.downloads = [...new Set<string>([...url, ...p.downloads])]
      }
    }

    const processModrinth = async () => {
      if (modrinthProjects.length === 0) return
      const result = await this.modrinthClient.getProjectVersionsById(modrinthProjects.map(v => v.modrinth.versionId), controller.signal)
      for (const r of result) {
        const p = modrinthProjects.find(p => p.modrinth.versionId === r.id)!
        if (!p.downloads) { p.downloads = [] }
        if (p.downloads.indexOf(r.files[0].url) === -1) {
          p.downloads.push(r.files[0].url)
        }
      }
    }

    const processModrinthLike = async () => {
      if (modrinthFileHashProjects.length === 0) return
      const result = await this.modrinthClient.getProjectVersionsByHash(modrinthFileHashProjects.filter(v => !!v.hashes.sha1).map(v => v.hashes.sha1), 'sha1', controller.signal)
      for (const r of Object.entries(result)) {
        const p = modrinthFileHashProjects.find(p => p.hashes.sha1 === r[0])!
        if (!p.downloads) { p.downloads = [] }
        if (p.downloads.indexOf(r[1].files[0].url) === -1) {
          p.downloads.push(r[1].files[0].url)
        }
        if (!p.modrinth) {
          p.modrinth = {
            projectId: r[1].project_id,
            versionId: r[1].id,
          }
        }
      }
    }

    await Promise.all([
      processCurseforge(),
      processModrinth(),
      processModrinthLike(),
    ])
  }

  protected abort(isCancelled: boolean): void {
    this.controller?.abort()
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}

class UnzipFileTask extends AbortableTask<void> {
  private stream: Readable | undefined

  constructor(private getEntry: Promise<readonly [ZipFile, Entry | undefined]>, private destination: string) {
    super()
  }

  protected async process(): Promise<void> {
    const [zip, entry] = await this.getEntry
    if (!entry) {
      throw new Error(`Cannot find zip entry for ${this.destination}`)
    }
    const stream = await openEntryReadStream(zip, entry)
    this._total = entry.uncompressedSize
    this.update(0)
    stream.on('data', (chunk) => {
      this._progress += chunk.length
      this.update(chunk.length)
    })
    this.stream = stream
    await ensureFile(this.destination)
    await pipeline(stream, createWriteStream(this.destination))
  }

  protected abort(isCancelled: boolean): void {
    this.stream?.destroy(new errors.RequestAbortedError())
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(PeerService) private peerService: PeerService,
    @Inject(CurseForgeService) private curseforgeService: CurseForgeService,
    @Inject(ModrinthService) private modrinthService: ModrinthService,
    @Inject(kResourceWorker) private worker: ResourceWorker,
  ) {
    super(app)
  }

  @Singleton((o) => o.path)
  async installInstanceFiles(options: InstallInstanceOptions): Promise<void> {
    const {
      path,
      files,
    } = options

    const instancePath = path || this.instanceService.state.path

    const instance = this.instanceService.state.all[instancePath]

    if (!instance) {
      throw new InstanceIOException({ instancePath, type: 'instanceNotFound' })
    }

    await this.writeInstallProfile(instancePath, files)

    const { writeInstallProfile } = this
    const curseforgeClient = this.curseforgeService.client
    const modrinthClient = this.modrinthService.client

    const zipBarrier = createPromiseSignal()
    const zips = new Set<string>()
    const zipInstances: Record<string, [ZipFile, Entry[]]> = {}
    const getEntry = async (file: string, entry: string) => {
      zips.add(file)
      await zipBarrier.promise
      const [instance, entries] = zipInstances[file]
      return [instance, entries.find(e => e.fileName === entry)] as const
    }

    const getTask = (file: InstanceFile) => this.getFileTask(file, instancePath, getEntry)

    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))

    const updateInstanceTask = task('installInstance', async function () {
      await lock.write(async () => {
        try {
          await this.yield(new ResolveInstanceFileTask(files, curseforgeClient, modrinthClient))
          await writeInstallProfile(instancePath, files)
        } catch {
          // Ignore
        }
        const tasks = await Promise.all(files.map(getTask)).then(v => v.filter(isNonnull))
        for (const zip of zips) {
          const zipInstance = await open(zip)
          zipInstances[zip] = [zipInstance, await readAllEntries(zipInstance)]
        }
        zipBarrier.resolve()
        await this.all(tasks, { throwErrorImmediately: false })
        Object.values(zipInstances).map(v => v[0].close())
      })
    }, { instance: instancePath })

    try {
      await this.submit(updateInstanceTask)
      await this.removeInstallProfile(instancePath)
    } catch (e) {
      await this.writeInstallProfile(instancePath, files)
      throw new Error(`Fail to install instance ${instancePath}`, { cause: e })
    }
  }

  async checkInstanceInstall() {
    const current = this.instanceService.state.path
    const profile = join(current, '.install-profile')
    if (existsSync(profile)) {
      try {
        const fileContent = JSON.parse(await readFile(profile, 'utf-8'))
        if (fileContent.lockVersion !== 0) {
          throw new Error(`Cannot identify lockfile version ${fileContent.lockVersion}`)
        }
        const files = fileContent.files as InstanceFile[]
        return files
      } catch (e) {
        if (e instanceof SyntaxError) {
          this.error(new Error(`Fail to parse instance install profile ${profile} as syntex error`, { cause: e }))
          await unlink(profile).catch(() => undefined)
        } else {
          throw e
        }
      }
    }
    return []
  }

  private async writeInstallProfile(path: string, files: InstanceFile[]) {
    const filePath = join(path, '.install-profile')
    const content = {
      lockVersion: 0,
      files,
    }
    await writeFile(filePath, JSON.stringify(content, null, 4))
  }

  private async removeInstallProfile(path: string) {
    const filePath = join(path, '.install-profile')
    await unlink(filePath)
  }

  private async getFileTask(file: InstanceFileWithOperation, instancePath: string, getEntry: (zipFile: string, entry: string) => Promise<readonly [ZipFile, Entry | undefined]>) {
    const createFileLinkTask = (dest: string, res: Resource) => task('file', async () => {
      const fstat = await stat(dest).catch(() => undefined)
      if (fstat && fstat.ino === res.ino) {
        // existed file, but same
        return
      }
      if (fstat) {
        // existed file
        await unlink(dest)
      }
      await linkWithTimeoutOrCopy(res.path, dest)
    })

    const createDownloadTask = async (file: InstanceFile, destination: string, pending?: string, sha1?: string) => {
      if (!file.downloads) {
        throw new Error(`Cannot resolve file! ${file.path}`)
      }

      const zipUrl = file.downloads.find(u => u.startsWith('zip:'))
      const peerUrl = file.downloads.find(u => u.startsWith('peer://'))
      const supportHttp = file.downloads.some(u => u.startsWith('http'))

      if (zipUrl) {
        const url = new URL(zipUrl)

        if (!url.host) {
          // Zip url with absolute path
          const zipPath = decodeURI(url.pathname).substring(1)
          const entry = url.searchParams.get('entry')
          if (entry) {
            const entryName = decodeURIComponent(entry)
            return new UnzipFileTask(getEntry(zipPath, entryName), destination)
          }
        }

        // Zip file using the sha1 resource relative apth
        const resource = await this.resourceService.getResourceByHash(url.host)
        if (resource) {
          return new UnzipFileTask(getEntry(resource.path, file.path), destination)
        }
      }

      if (supportHttp) {
        // Prefer HTTP download than peer download
        return new DownloadTask({
          ...this.networkManager.getDownloadBaseOptions(),
          url: file.downloads.filter(u => u.startsWith('http')),
          destination,
          pendingFile: pending,
          skipRevalidate: true,
          validator: sha1
            ? {
              hash: sha1,
              algorithm: 'sha1',
            }
            : undefined,
        })
      }

      if (peerUrl) {
        // Use peer download if none of above existed
        return this.peerService.createDownloadTask(peerUrl, destination, sha1 ?? '', file.size)
      }

      throw new Error(`Cannot resolve file! ${file.path}`)
    }

    const sha1 = file.hashes.sha1
    const filePath = join(instancePath, file.path)

    if (relative(instancePath, filePath).startsWith('..')) {
      return undefined
    }

    const actualSha1 = await this.worker.checksum(filePath, 'sha1').catch(() => undefined)
    if (!!sha1 && actualSha1 === sha1) {
      if (file.operation === 'remove') {
        await unlink(filePath).catch(() => undefined)
      }
      // skip same file
      return undefined
    }

    if (file.operation === 'remove') {
      await unlink(filePath).catch(() => undefined)
      return
    }
    if (file.operation === 'backup-remove') {
      await rename(filePath, filePath + '.backup')
      return
    }

    const metadata: ResourceMetadata = {}
    if (file.curseforge) {
      metadata.curseforge = {
        fileId: file.curseforge.fileId,
        projectId: file.curseforge.projectId,
      }
    }

    if (file.modrinth) {
      metadata.modrinth = {
        versionId: file.modrinth.versionId,
        projectId: file.modrinth.projectId,
      }
    }

    const urls = [] as string[]

    if (file.downloads) {
      urls.push(...file.downloads)
    }

    const resource = await this.resourceService.getResourceByHash(sha1)

    if (resource) {
      if ((metadata.modrinth && !resource.metadata.modrinth) || (metadata.curseforge && resource.metadata.curseforge) || (urls.length > 0 && urls.some(u => resource.uris.indexOf(u) === -1))) {
        if (!resource.hash) {
          this.error(new TypeError('Invalid resource ' + JSON.stringify(resource)))
        } else {
          await this.resourceService.updateResources([{ hash: resource.hash, metadata, uris: urls }]).catch((e) => {
            this.warn(`Fail to update existed resource ${resource.name}(${resource.hash}) metadata during instance install:`)
            this.warn(e)
          })
        }
      }
      return createFileLinkTask(filePath, resource)
    }

    const shouldPending = file.path.startsWith(ResourceDomain.Mods) || file.path.startsWith(ResourceDomain.ResourcePacks) || file.path.startsWith(ResourceDomain.ShaderPacks)
    const destination = filePath
    const pending = shouldPending ? `${filePath}.pending` : undefined

    const downloadTask = await createDownloadTask(file, destination, pending, sha1)

    if (file.operation === 'backup-add') {
      // backup legacy file
      await rename(destination, destination + '.backup').catch(() => undefined)
    }

    return downloadTask.setName('file').map(async () => {
      await this.resourceService.updateResources([{ hash: file.hashes.sha1, metadata }])
      return undefined
    })
  }
}
