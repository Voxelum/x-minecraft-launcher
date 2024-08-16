import { DownloadOptions } from '@xmcl/file-transfer'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceFile, InstanceFileWithOperation, Resource, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { extname, join, relative } from 'path'
import { Logger } from '~/logger'
import { kDownloadOptions } from '~/network'
import { kPeerFacade } from '~/peer'
import { ResourceService, ResourceWorker } from '~/resource'
import { LauncherApp } from '../app/LauncherApp'
import { AnyError } from '../util/error'
import { InstanceFileDownloadTask } from './InstanceFileDownloadTask'
import { InstanceFileOperationTask } from './InstanceFileOperationTask'
import { UnzipFileTask } from './UnzipFileTask'

export class InstanceFileOperationHandler {
  #resourceToUpdate: Array<{ hash: string; metadata: ResourceMetadata; uris: string[]; destination: string }> = []
  #copyOrLinkQueue: Array<{ file: InstanceFile; destination: string }> = []
  #unzipQueue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }> = []
  #resourceLinkQueue: Array<{ file: InstanceFile; destination: string; resource: Resource }> = []
  #filesQueue: Array<{ file: InstanceFile; destination: string }> = []
  #httpsQueue: Array<{ file: InstanceFile; options: DownloadOptions }> = []

  /**
   * Finished file operations
   */
  readonly finished: Set<InstanceFileWithOperation> = new Set()

  constructor(private app: LauncherApp, private resourceService: ResourceService, private worker: ResourceWorker,
    private logger: Logger,
    private instancePath: string) { }

  /**
  * Get a task to handle the instance file operation
  */
  async #handleFile(file: InstanceFileWithOperation) {
    const sha1 = file.hashes.sha1
    const instancePath = this.instancePath
    const destination = join(instancePath, file.path)

    if (relative(instancePath, destination).startsWith('..')) {
      return undefined
    }

    if (file.operation === 'remove') {
      this.#filesQueue.push({
        file,
        destination,
      })
      return
    }

    if (file.operation === 'backup-remove') {
      this.#filesQueue.push({
        file,
        destination,
      })
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

    const isSpecialResource = file.path.startsWith(ResourceDomain.Mods) || file.path.startsWith(ResourceDomain.ResourcePacks) || file.path.startsWith(ResourceDomain.ShaderPacks)
    const pending = isSpecialResource ? `${destination}.pending` : undefined
    if (isSpecialResource) {
      const urls = file.downloads || []
      this.#resourceToUpdate.push({ destination, hash: sha1, metadata, uris: urls.filter(u => u.startsWith('http')) })
    }

    await this.#dispatchFileTask(file, destination, metadata, pending, sha1)

    if (file.operation === 'backup-add') {
      // backup legacy file
      this.#filesQueue.push({ file, destination })
    }
  }

  /**
  * Start to process all the instance files. This is due to there are zip task which need to read all the zip entries.
  */
  async process(file: InstanceFileWithOperation[]) {
    for (const f of file) {
      await this.#handleFile(f)
    }
    const tasks = [] as Task[]
    if (this.#httpsQueue.length > 0) {
      tasks.unshift(await this.#getDownloadTask())
    }
    if (this.#copyOrLinkQueue.length > 0 || this.#resourceLinkQueue.length > 0) {
      tasks.unshift(await this.#getFileOperationTask())
    }
    if (this.#unzipQueue.length > 0) {
      tasks.unshift(await this.#getUnzipTask())
    }
    return tasks
  }

  async postprocess(client: ModrinthV2Client) {
    try {
      if (this.#resourceToUpdate.length > 0) {
        const options = await Promise.all(this.#resourceToUpdate.map(async ({ hash, metadata, uris, destination }) => {
          const actualSha1 = hash ?? await this.worker.checksum(destination, 'sha1').catch(() => undefined)
          return {
            hash: actualSha1,
            metadata,
            uris,
          }
        }))

        const toQuery = options.filter(r => Object.keys(r.metadata).length === 0).map(r => r.hash)
        if (toQuery.length > 0) {
          const modrinthMetadata = await client.getProjectVersionsByHash(toQuery, 'sha1')

          for (const o of options) {
            const modrinth = modrinthMetadata[o.hash]
            if (modrinth) {
              o.metadata.modrinth = {
                projectId: modrinth.project_id,
                versionId: modrinth.id,
              }
            }
          }
        }

        await this.resourceService.updateResources(options.filter(o => !!o.hash))
      }
    } catch (e) {
      this.logger.error(e as any)
    }
  }

  async #handleUnzip(file: InstanceFile, destination: string) {
    const zipUrl = file.downloads!.find(u => u.startsWith('zip:'))
    if (!zipUrl) return

    const url = new URL(zipUrl)

    if (!url.host) {
      // Zip url with absolute path
      const zipPath = decodeURI(url.pathname).substring(1)
      const entry = url.searchParams.get('entry')
      if (entry) {
        const entryName = entry
        this.#unzipQueue.push({ file, zipPath, entryName, destination })
        return true
      }
    }

    // Zip file using the sha1 resource relative apth
    const resource = await this.resourceService.getResourceByHash(url.host)
    if (resource) {
      this.#unzipQueue.push({ file, zipPath: resource.path, entryName: file.path, destination })
      return true
    }
  }

  async #handleHttp(file: InstanceFile, destination: string, pending?: string, sha1?: string) {
    const urls = file.downloads!.filter(u => u.startsWith('http'))
    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    const peerUrl = file.downloads!.find(u => u.startsWith('peer://'))

    if (peerUrl) {
      if (this.app.registry.has(kPeerFacade)) {
        const peerService = await this.app.registry.get(kPeerFacade)
        const url = peerService.getHttpDownloadUrl(peerUrl)
        urls.push(url)
      }
    }

    if (urls.length > 0) {
      // Prefer HTTP download than peer download
      this.#httpsQueue.push({
        options: {
          ...downloadOptions,
          url: urls,
          destination,
          pendingFile: pending,
          validator: sha1
            ? {
              hash: sha1,
              algorithm: 'sha1',
            }
            : undefined,
        },
        file,
      })
      return true
    }
  }

  async #handleLinkResource(file: InstanceFile, destination: string, metadata: ResourceMetadata, sha1: string) {
    if (!sha1) return

    const urls = file.downloads?.filter(u => u.startsWith('http')) || []
    const resource = await this.resourceService.getResourceByHash(sha1)

    if (resource && await this.resourceService.touchResource(resource)) {
      if (
        (metadata.modrinth && !resource.metadata.modrinth) ||
        (metadata.curseforge && resource.metadata.curseforge) ||
        (urls.length > 0 && urls.some(u => resource.uris.indexOf(u) === -1))
      ) {
        if (!resource.hash) {
          this.logger.error(new TypeError('Invalid resource ' + JSON.stringify(resource)))
        } else {
          this.#resourceToUpdate.push({ destination, hash: sha1, metadata, uris: urls })
        }
      }
      this.#resourceLinkQueue.push({ file, destination, resource })
      return true
    }
  }

  async #handleCopyOrLink(file: InstanceFile, destination: string) {
    if (file.downloads) {
      if (file.downloads[0].startsWith('file://')) {
        this.#copyOrLinkQueue.push({ file, destination })
        return true
      }
    }
  }

  async #dispatchFileTask(file: InstanceFile, destination: string, metadata: ResourceMetadata, pending: string | undefined, sha1: string) {
    if (await this.#handleCopyOrLink(file, destination)) return

    if (await this.#handleLinkResource(file, destination, metadata, sha1)) return

    if (!file.downloads) {
      throw new AnyError('DownloadFileError', 'Cannot create download file task', undefined, { file })
    }

    if (await this.#handleUnzip(file, destination)) return

    if (await this.#handleHttp(file, destination, pending, sha1)) return

    throw new AnyError('DownloadFileError', `Cannot resolve file! ${file.path}`)
  }

  async #getFileOperationTask() {
    return new InstanceFileOperationTask(
      this.#copyOrLinkQueue,
      this.#resourceLinkQueue,
      this.#filesQueue,
      this.app.platform,
      this.finished,
    )
  }

  async #getUnzipTask() {
    return new UnzipFileTask(this.#unzipQueue, this.finished, (input, file) => {
    })
  }

  async #getDownloadTask() {
    return new InstanceFileDownloadTask(this.#httpsQueue, this.finished)
  }
}
