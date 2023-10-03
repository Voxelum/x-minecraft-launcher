import { CurseforgeV1Client } from '@xmcl/curseforge'
import { DownloadTask } from '@xmcl/installer'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceFile, InstanceFileWithOperation, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { AbortableTask, task } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { writeFile } from 'atomically'
import { createWriteStream } from 'fs'
import { ensureDir } from 'fs-extra'
import { rename, stat, unlink } from 'fs/promises'
import { dirname, join, relative } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { errors } from 'undici'
import { Entry, ZipFile } from 'yauzl'
import { LauncherApp } from '../app/LauncherApp'
import { kDownloadOptions } from '../entities/downloadOptions'
import { ResourceWorker } from '../entities/resourceWorker'
import { PeerService } from '../services/PeerService'
import { ResourceService } from '../services/ResourceService'
import { guessCurseforgeFileUrl } from '../util/curseforge'
import { AnyError } from '../util/error'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { Logger } from '../util/log'
import { createPromiseSignal } from '../util/promiseSignal'

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
      throw new AnyError('UnzipError', `Cannot find zip entry for ${this.destination}`)
    }
    await ensureDir(dirname(this.destination))
    const stream = await openEntryReadStream(zip, entry)
    this._total = entry.uncompressedSize
    this.update(0)
    stream.on('data', (chunk) => {
      this._progress += chunk.length
      this.update(chunk.length)
    })
    this.stream = stream
    await pipeline(stream, createWriteStream(this.destination))
  }

  protected abort(isCancelled: boolean): void {
    this.stream?.destroy(new errors.RequestAbortedError())
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}

export class FileDownloadHandler {
  #zips = new Set<string>()
  #zipInstances: Record<string, [ZipFile, Entry[]]> = {}
  #zipBarrier = createPromiseSignal()

  constructor(private app: LauncherApp, private resourceService: ResourceService, private worker: ResourceWorker,
    private logger: Logger,
    private instancePath: string) { }

  /**
   * Get a task to handle the instance file operation
   */
  async getTask(file: InstanceFileWithOperation) {
    const sha1 = file.hashes.sha1
    const instancePath = this.instancePath
    const destination = join(instancePath, file.path)

    if (relative(instancePath, destination).startsWith('..')) {
      return undefined
    }

    const actualSha1 = await this.worker.checksum(destination, 'sha1').catch(() => undefined)
    if (!!sha1 && actualSha1 === sha1) {
      if (file.operation === 'remove') {
        await unlink(destination).catch(() => undefined)
      }
      // skip same file
      return undefined
    }

    if (file.operation === 'remove') {
      await unlink(destination).catch(() => undefined)
      return
    }
    if (file.operation === 'backup-remove') {
      await rename(destination, destination + '.backup')
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

    const shouldPending = file.path.startsWith(ResourceDomain.Mods) || file.path.startsWith(ResourceDomain.ResourcePacks) || file.path.startsWith(ResourceDomain.ShaderPacks)
    const pending = shouldPending ? `${destination}.pending` : undefined

    const fileTask = await this.#getFileTask(file, destination, metadata, pending, sha1, urls)

    if (file.operation === 'backup-add') {
      // backup legacy file
      await rename(destination, destination + '.backup').catch(() => undefined)
    }

    return fileTask.setName('file', { file: file.path }).map(async () => ({
      file,
      sha1: file.hashes.sha1 ? file.hashes.sha1 : await this.worker.hash(destination, (await stat(destination)).size),
      metadata,
      urls,
    }))
  }

  /**
   * Start to process all the instance files. This is due to there are zip task which need to read all the zip entries.
   */
  async process() {
    for (const zip of this.#zips) {
      const zipInstance = await open(zip)
      this.#zipInstances[zip] = [zipInstance, await readAllEntries(zipInstance)]
    }
    this.#zipBarrier.resolve()
  }

  /**
   * Dispose the handler.
   *
   * This is majorly used for close all the zip file.
   */
  dispose() {
    Object.values(this.#zipInstances).map(v => v[0].close())
  }

  #getEntry = async (file: string, entry: string) => {
    this.#zips.add(file)
    await this.#zipBarrier.promise
    const [instance, entries] = this.#zipInstances[file]
    return [instance, entries.find(e => e.fileName === entry)] as const
  }

  async #getUnzipTask(file: InstanceFile, destination: string) {
    const zipUrl = file.downloads!.find(u => u.startsWith('zip:'))
    if (!zipUrl) return undefined

    const url = new URL(zipUrl)

    if (!url.host) {
      // Zip url with absolute path
      const zipPath = decodeURI(url.pathname).substring(1)
      const entry = url.searchParams.get('entry')
      if (entry) {
        const entryName = decodeURIComponent(entry)
        this.logger.log(`Unzip ${destination}`)
        return new UnzipFileTask(this.#getEntry(zipPath, entryName), destination)
      }
    }

    // Zip file using the sha1 resource relative apth
    const resource = await this.resourceService.getResourceByHash(url.host)
    if (resource) {
      this.logger.log(`Unzip ${destination}`)
      return new UnzipFileTask(this.#getEntry(resource.path, file.path), destination)
    }
  }

  async #getHttpTask(file: InstanceFile, destination: string, pending?: string, sha1?: string) {
    const urls = file.downloads!.filter(u => u.startsWith('http'))
    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    if (urls.length > 0) {
      // Prefer HTTP download than peer download
      return new DownloadTask({
        ...downloadOptions,
        url: urls,
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
  }

  async #getPeerTask(file: InstanceFile, destination: string, sha1?: string) {
    const peerUrl = file.downloads!.find(u => u.startsWith('peer://'))
    if (peerUrl) {
      if (this.app.registry.has(PeerService)) {
        const peerService = await this.app.registry.get(PeerService)
        // Use peer download if none of above existed
        return peerService.createDownloadTask(peerUrl, destination, sha1 ?? '', file.size)
      }
    }
  }

  async #getLinkTask(file: InstanceFile, destination: string, metadata: ResourceMetadata, sha1: string, urls: string[]) {
    const resource = await this.resourceService.getResourceByHash(sha1)

    if (resource) {
      if ((metadata.modrinth && !resource.metadata.modrinth) || (metadata.curseforge && resource.metadata.curseforge) || (urls.length > 0 && urls.some(u => resource.uris.indexOf(u) === -1))) {
        if (!resource.hash) {
          this.logger.error(new TypeError('Invalid resource ' + JSON.stringify(resource)))
        } else {
          await this.resourceService.updateResources([{ hash: resource.hash, metadata, uris: urls }]).catch((e) => {
            this.logger.warn(`Fail to update existed resource ${resource.name}(${resource.hash}) metadata during instance install:`)
            this.logger.warn(e)
          })
        }
      }
      this.logger.log(`Link ${file.path}`)

      return task('file', async () => {
        const fstat = await stat(destination).catch(() => undefined)
        if (fstat && fstat.ino === resource.ino) {
          // existed file, but same
          return
        }
        if (fstat) {
          // existed file
          await unlink(destination)
        }
        await ensureDir(dirname(destination))
        const err = await linkWithTimeoutOrCopy(resource.path, destination)
        if (err) {
          this.logger.warn(`Fail to link ${resource.path} -> ${destination} due to error`)
          this.logger.warn(err)
        }
      })
    }
  }

  async #getFileTask(file: InstanceFile, destination: string, metadata: ResourceMetadata, pending: string | undefined, sha1: string, urls: string[]) {
    const linkTask = await this.#getLinkTask(file, destination, metadata, sha1, urls)
    if (linkTask) return linkTask

    if (!file.downloads) {
      throw new AnyError('DownloadFileError', 'Cannot create download file task', undefined, { file })
    }

    const zipTask = await this.#getUnzipTask(file, destination)
    if (zipTask) return zipTask

    const httpTask = await this.#getHttpTask(file, destination, pending, sha1)
    if (httpTask) return httpTask

    const peerTask = await this.#getPeerTask(file, destination, sha1)
    if (peerTask) return peerTask

    throw new AnyError('DownloadFileError', `Cannot resolve file! ${file.path}`)
  }
}

/**
 * Post process the instance file. It will try to update the resource metadata
 */
export async function postprocess(client: ModrinthV2Client, resourceService: ResourceService, result: { file: InstanceFile; sha1: string; metadata: ResourceMetadata; urls: string[] }[]) {
  result = result.filter(({ metadata, file }) => file.path.startsWith('mods') && (!!metadata.curseforge || !!metadata.modrinth))
  const versions = await client.getProjectVersionsByHash(result.map(r => r.sha1), 'sha1')
  for (const r of result) {
    const modrinth = versions[r.sha1]
    if (modrinth) {
      r.metadata.modrinth = {
        projectId: modrinth.project_id,
        versionId: modrinth.id,
      }
    }
  }

  await resourceService.updateResources(result.map(r => ({ hash: r.sha1, metadata: r.metadata, uris: r.urls })))
}

export async function writeInstallProfile(path: string, files: InstanceFile[]) {
  const filePath = join(path, '.install-profile')
  const content = {
    lockVersion: 0,
    files,
  }
  await writeFile(filePath, JSON.stringify(content, null, 4))
}

export async function removeInstallProfile(path: string) {
  const filePath = join(path, '.install-profile')
  await unlink(filePath)
}
