import { DownloadTask } from '@xmcl/installer'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceFile, InstanceFileWithOperation, Resource, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { rename, unlink } from 'fs-extra'
import { join, relative } from 'path'
import { Logger } from '~/logger'
import { kDownloadOptions } from '~/network'
import { PeerService } from '~/peer'
import { ResourceService, ResourceWorker } from '~/resource'
import { LauncherApp } from '../app/LauncherApp'
import { AnyError } from '../util/error'
import { LinkFilesTask } from './LinkFilesTask'
import { UnzipFileTask } from './UnzipFileTask'

export class InstanceFileOperationHandler {
  #tasks: Array<Task<any>> = []
  #resourceToUpdate: Array<{ hash: string; metadata: ResourceMetadata; uris: string[]; destination: string }> = []
  #copyOrLinkQueue: Array<{ file: InstanceFile; destination: string }> = []
  #unzipQueue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }> = []
  #resourceLinkQueue: Array<{ file: InstanceFile; destination: string; resource: Resource }> = []

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
      const actualSha1 = await this.worker.checksum(destination, 'sha1').catch(() => undefined)
      if (!!sha1 && actualSha1 === sha1) {
        await unlink(destination).catch(() => undefined)
      }
      // skip same file
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

    const isSpecialResource = file.path.startsWith(ResourceDomain.Mods) || file.path.startsWith(ResourceDomain.ResourcePacks) || file.path.startsWith(ResourceDomain.ShaderPacks)
    const pending = isSpecialResource ? `${destination}.pending` : undefined
    if (isSpecialResource) {
      const urls = file.downloads || []
      this.#resourceToUpdate.push({ destination, hash: sha1, metadata, uris: urls.filter(u => u.startsWith('http')) })
    }

    const task = await this.#getFileTask(file, destination, metadata, pending, sha1)
    if (task) {
      task.setName('file', { file: file.path })
      this.#tasks.push(task)
    }

    if (file.operation === 'backup-add') {
      // backup legacy file
      await rename(destination, destination + '.backup').catch(() => undefined)
    }
  }

  /**
  * Start to process all the instance files. This is due to there are zip task which need to read all the zip entries.
  */
  async process(file: InstanceFileWithOperation[]) {
    for (const f of file) {
      await this.#handleFile(f)
    }
    if (this.#copyOrLinkQueue.length > 0 || this.#resourceLinkQueue.length > 0) {
      this.#tasks.unshift(await this.#getCopyOrLinkTask())
    }
    if (this.#unzipQueue.length > 0) {
      this.#tasks.unshift(await this.#getUnzipTask())
    }
    return this.#tasks
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
        const entryName = decodeURIComponent(entry)
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

  async #getUnzipTask() {
    return new UnzipFileTask(this.#unzipQueue)
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

  async #getCopyOrLinkTask() {
    return new LinkFilesTask(this.#copyOrLinkQueue, this.#resourceLinkQueue, this.app.platform)
  }

  async #handleCopyOrLink(file: InstanceFile, destination: string) {
    if (file.downloads) {
      if (file.downloads[0].startsWith('file://')) {
        this.#copyOrLinkQueue.push({ file, destination })
        return true
      }
    }
  }

  async #getFileTask(file: InstanceFile, destination: string, metadata: ResourceMetadata, pending: string | undefined, sha1: string) {
    if (await this.#handleCopyOrLink(file, destination)) return

    if (await this.#handleLinkResource(file, destination, metadata, sha1)) return

    if (!file.downloads) {
      throw new AnyError('DownloadFileError', 'Cannot create download file task', undefined, { file })
    }

    if (await this.#handleUnzip(file, destination)) return

    const httpTask = await this.#getHttpTask(file, destination, pending, sha1)
    if (httpTask) return httpTask

    const peerTask = await this.#getPeerTask(file, destination, sha1)
    if (peerTask) return peerTask

    throw new AnyError('DownloadFileError', `Cannot resolve file! ${file.path}`)
  }
}
