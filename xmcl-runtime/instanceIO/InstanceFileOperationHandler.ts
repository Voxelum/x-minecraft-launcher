import { DownloadOptions } from '@xmcl/file-transfer'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceFile, InstanceFileUpdate, ResourceDomain, ResourceMetadata } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { ensureDir, remove, rename, rmdir, unlink } from 'fs-extra'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { kGameDataPath } from '~/app'
import { Logger } from '~/logger'
import { kDownloadOptions } from '~/network'
import { kPeerFacade } from '~/peer'
import { ResourceManager, ResourceWorker } from '~/resource'
import { ZipManager } from '~/zipManager/ZipManager'
import { LauncherApp } from '../app/LauncherApp'
import { InstanceFileDownloadTask } from './InstanceFileDownloadTask'
import { InstanceFileLinkTask } from './InstanceFileOperationTask'
import { UnzipFileTask } from './UnzipFileTask'

/**
 * The handler to handle the instance file install.
 *
 * In the process, there will be 3 folder location involved:
 * 1. instance location: the location where the instance files are located
 * 2. workspace location: the location where the files are downloaded and unzipped
 * 3. backup location: the location where the files are backuped or removed
 *
 * The whole process is divided into three phases:
 * 1. Link or copy existed files to workspace folder. Download and unzip news files into workspace location. The linked failed files will be downloaded.
 * 2. Move files which need to be removed or backup to backup location
 * 3. Rename workspace location files into instance location
 *
 * The step 2 and 3 will modify the original instance files.
 * If the process is interrupted, the instance files need to be restored to the original state.
 * The backup folder will only exist if the whole process is successfully finished.
 * The workspace location will be kept if the process is interrupted, or it will be removed if it's successfully finished.
 */
export class InstanceFileOperationHandler {
  // Phase 1: Download and unzip files into a workspace location
  /**
   * All files need to be downloaded
   */
  #httpsQueue: Array<{ file: InstanceFile; options: DownloadOptions }> = []
  /**
   * All files need to be unzipped
   */
  #unzipQueue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }> = []
  // Phase 2: Move files from workspace location to instance location
  /**
   * All files need to be removed or backup
   */
  #backupQueue: Array<InstanceFile> = []
  #removeQueue: Array<InstanceFile> = []
  // Phase 3: Link or copy existed files
  /**
   * Extra files need to be copied or linked
   */
  #linkQueue: Array<{ file: InstanceFile; src: string; destination: string }> = []
  // Phase extra: Update resource metadata
  /**
   * All resources need to be updated
   */
  #resourceToUpdate: Array<{ hash: string; metadata: ResourceMetadata; uris: string[]; destination: string }> = []

  /**
   * Store the unresolvable files.
   *
   * This will be recomputed each time the handler is processed.
   */
  readonly unresolvable: InstanceFile[] = []

  constructor(
    private app: LauncherApp,
    private resourceManager: ResourceManager,
    private worker: ResourceWorker,
    private logger: Logger,
    private instancePath: string,
    /**
     * Finished download/unzip/link file path
     */
    readonly finished: Set<string>,
    private workspacePath: string,
    private backupPath: string,
  ) {
  }

  /**
  * Get a task to handle the instance file operation
  */
  async #handleFile({ file, operation }: InstanceFileUpdate) {
    const instancePath = this.instancePath
    const destination = join(instancePath, file.path)

    if (relative(instancePath, destination).startsWith('..')) {
      return
    }

    if (operation === 'keep') {
      return
    }

    if (operation === 'remove') {
      this.#backupQueue.push(file)
      this.#removeQueue.push(file)
      return
    }

    if (operation === 'backup-remove') {
      this.#backupQueue.push(file)
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
    const sha1 = file.hashes.sha1
    if (isSpecialResource) {
      const urls = file.downloads || []
      this.#resourceToUpdate.push({ destination, hash: sha1, metadata, uris: urls.filter(u => u.startsWith('http')) })
    }

    await this.#dispatchFileTask(file, metadata, sha1)

    if (operation === 'backup-add') {
      // backup legacy file
      this.#backupQueue.push(file)
    }
  }

  /**
  * Emit the task to prepare download & unzip files into workspace location.
  *
  * These tasks will do the phase 1 of the instance file operation.
  */
  async * prepareInstallFilesTasks(file: InstanceFileUpdate[]) {
    for (const f of file) {
      await this.#handleFile(f)
    }

    const unhandled = [] as InstanceFile[]
    if (this.#linkQueue.length > 0) {
      yield [this.#getFileOperationTask(unhandled)] as Task[]
    }

    for (const file of unhandled) {
      if (await this.#handleUnzip(file, join(this.workspacePath, file.path))) continue
      if (await this.#handleHttp(file, join(this.workspacePath, file.path))) continue
      this.unresolvable.push(file)
    }

    const phase1 = [] as Task[]
    if (this.#unzipQueue.length > 0) {
      phase1.push(await this.#getUnzipTask())
    }
    if (this.#httpsQueue.length > 0) {
      phase1.push(this.#getDownloadTask())
    }
    yield phase1
  }

  /**
   * Do the phase 2 and 3, move files from workspace location to instance location and link or copy existed files.
   */
  async backupAndRename() {
    // phase 2, create the backup
    const finished = [] as [string, string][]
    try {
      for (const file of this.#backupQueue) {
        const src = join(this.instancePath, file.path)
        const dest = join(this.backupPath, file.path)

        await ensureDir(dirname(dest))
        await rename(src, dest)
        finished.push([src, dest])
      }
    } catch (e) {
      // rollback with best effort
      this.logger.warn('Rollback due to backup files failed', e)
      for (const [src, dest] of finished) {
        await rename(dest, src).catch(() => undefined)
      }

      throw e
    }
    this.logger.log('Backup stage finished', finished.length)

    finished.splice(0, finished.length)

    // phase 3, move the workspace files to instance location
    await ensureDir(this.instancePath)
    const files = [
      ...this.#linkQueue.map(f => f.file),
      ...this.#unzipQueue.map(f => f.file),
      ...this.#httpsQueue.map(f => f.file),
    ]

    try {
      const dirToCreate = Array.from(new Set(files.map(file => dirname(join(this.instancePath, file.path)))))
      await Promise.all(dirToCreate.map(dir => ensureDir(dir)))

      await Promise.all(files.map(async (file) => {
        const src = join(this.workspacePath, file.path)
        const dest = join(this.instancePath, file.path)
        await rename(src, dest)
        finished.push([src, dest])
      }))
    } catch (e) {
      // rollback with best effort
      this.logger.warn('Rollback due to rename files failed', e)
      for (const [src, dest] of finished) {
        await rename(dest, src).catch(() => undefined)
      }

      throw e
    }
    this.logger.log('Rename stage finished', finished.length)

    for (const file of this.#removeQueue) {
      const dest = join(this.backupPath, file.path)
      await unlink(dest).catch(() => undefined)
      await rmdir(dirname(dest)).catch(() => undefined)
    }
    this.logger.log('Remove stage finished', this.#removeQueue.length)

    // Remove the workspace folder
    await remove(this.workspacePath)
  }

  async updateResourceMetadata(client: ModrinthV2Client) {
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

        await this.resourceManager.updateMetadata(options.filter(o => !!o.hash))
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
    const resource = await this.resourceManager.getSnapshotByHash(url.host)
    if (resource) {
      const getPath = await this.app.registry.get(kGameDataPath)
      this.#unzipQueue.push({ file, zipPath: getPath(resource.domainedPath), entryName: file.path, destination })
      return true
    }
  }

  /**
   * Handle a file with http download. If the file can be handled by http, return `true`
   */
  async #handleHttp(file: InstanceFile, destination: string, sha1?: string) {
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
          validator: sha1
            ? {
              hash: sha1,
              algorithm: 'sha1',
            }
            : undefined,
          expectedTotal: file.size,
        },
        file,
      })
      return true
    }
  }

  /**
   * Handle a file with link. If the file is existed in database, then it can be handled by link, return `true`
   */
  async #handleLink(file: InstanceFile, destination: string, metadata: ResourceMetadata, sha1: string) {
    if (file.downloads) {
      if (file.downloads[0].startsWith('file://')) {
        this.#linkQueue.push({ file, src: fileURLToPath(file.downloads[0]), destination })
        return true
      }
    }

    if (!sha1) return

    const urls = file.downloads?.filter(u => u.startsWith('http')) || []

    let snapshot = await this.resourceManager.getSnapshotByHash(sha1)

    if (snapshot) {
      if (!await this.resourceManager.validateSnapshot(snapshot)) {
        snapshot = undefined
      }
    }

    if (snapshot) {
      const cachedMetadata = await this.resourceManager.getMetadataByHash(sha1)
      const uris = await this.resourceManager.getUriByHash(sha1)
      if (
        !cachedMetadata ||
        (metadata.modrinth && !cachedMetadata.modrinth) ||
        (metadata.curseforge && cachedMetadata.curseforge) ||
        (urls.length > 0 && urls.some(u => uris.indexOf(u) === -1))
      ) {
        this.#resourceToUpdate.push({ destination, hash: sha1, metadata, uris: urls })
      }
      this.#linkQueue.push({ file, destination, src: this.resourceManager.getSnapshotPath(snapshot) })
      return true
    }
  }

  async #dispatchFileTask(file: InstanceFile, metadata: ResourceMetadata, sha1: string) {
    const destination = join(this.workspacePath, file.path)
    if (await this.#handleLink(file, destination, metadata, sha1)) return

    if (!file.downloads) {
      this.unresolvable.push(file)
      return
    }

    if (await this.#handleUnzip(file, destination)) return

    if (await this.#handleHttp(file, destination, sha1)) return

    this.unresolvable.push(file)
  }

  #getFileOperationTask(unhandled: InstanceFile[]) {
    return new InstanceFileLinkTask(
      this.#linkQueue,
      this.app.platform,
      this.finished,
      unhandled,
    )
  }

  async #getUnzipTask() {
    return new UnzipFileTask(await this.app.registry.getOrCreate(ZipManager), this.#unzipQueue, this.finished)
  }

  #getDownloadTask() {
    return new InstanceFileDownloadTask(this.#httpsQueue, this.finished)
  }
}
