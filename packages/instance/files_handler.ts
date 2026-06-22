import { ensureDir, remove, rename, rmdir, stat, unlink } from 'fs-extra'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { InstanceFile, InstanceFileUpdate } from './files'
import { ChecksumWorker, Logger } from './internal_type'

export interface InstanceFileOperationHandlerContext {
  worker: ChecksumWorker

  logger: Logger

  onSpecialFile: (file: InstanceFile) => void

  getCachedResource(sha1: string): Promise<string | undefined>

  getPeerActualUrl: (peerUrl: string) => Promise<string | undefined>

  unzipFiles: (p: UnzipTaskPayload[], finished: Set<string>, signal: AbortSignal) => Promise<void>

  downloadFiles: (p: HttpTaskPayload[], finished: Set<string>, signal: AbortSignal) => Promise<void>

  linkFiles: (
    p: FileOperationPayload[],
    finished: Set<string>,
    unhandled: InstanceFile[],
    signal: AbortSignal,
  ) => Promise<void>
}

export interface UnzipTaskPayload {
  file: InstanceFile
  zipPath: string
  entryName: string
  destination: string
}
export interface HttpTaskPayload {
  file: InstanceFile
  options: { urls: string[]; sha1?: string; destination: string; size?: number }
}
export interface FileOperationPayload {
  file: InstanceFile
  src: string
  destination: string
}

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
  #httpsQueue: Array<HttpTaskPayload> = []
  /**
   * All files need to be unzipped
   */
  #unzipQueue: Array<UnzipTaskPayload> = []
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
  #linkQueue: Array<FileOperationPayload> = []
  /**
   * Files that are already complete in the workspace (e.g. resumed from
   * a prior install run). They do not need any phase-1 work, but phase
   * 3 must still move them from the workspace into the instance —
   * otherwise the workspace folder is removed at the end of phase 3 and
   * the files are silently lost.
   */
  #readyQueue: Array<InstanceFile> = []

  /**
   * Store the unresolvable files.
   *
   * This will be recomputed each time the handler is processed.
   */
  readonly unresolvable: InstanceFile[] = []

  constructor(
    private instancePath: string,
    /**
     * Finished download/unzip/link file path
     */
    readonly finished: Set<string>,
    private workspacePath: string,
    private backupPath: string,
    private context: InstanceFileOperationHandlerContext,
  ) {}

  /**
   * Emit the task to prepare download & unzip files into workspace location.
   *
   * These tasks will do the phase 1 of the instance file operation.
   */
  async prepareInstallFiles(file: InstanceFileUpdate[], signal: AbortSignal) {
    const batchSize = 64;
    for (let i = 0; i < file.length; i += batchSize) {
        const batch = file.slice(i, i + batchSize);
        await Promise.all(batch.map(f => this.#handleFile(f)));
    }

    const unhandled = [] as InstanceFile[]
    if (this.#linkQueue.length > 0) {
      await this.context.linkFiles(this.#linkQueue, this.finished, unhandled, signal)
    }

    for (const file of unhandled) {
      if (await this.#handleUnzip(file, join(this.workspacePath, file.path))) continue
      if (await this.#handleHttp(file, join(this.workspacePath, file.path), file.hashes.sha1)) continue
      this.unresolvable.push(file)
    }

    const phase1Promises: Promise<void>[] = []
    if (this.#unzipQueue.length > 0) {
      phase1Promises.push(this.context.unzipFiles(this.#unzipQueue, this.finished, signal))
    }
    if (this.#httpsQueue.length > 0) {
      phase1Promises.push(this.context.downloadFiles(this.#httpsQueue, this.finished, signal))
    }
    await Promise.all(phase1Promises)
  }

  /**
   * Do the phase 2 and 3, move files from workspace location to instance location and link or copy existed files.
   */
  async backupAndRename() {
    // phase 2, create the backup
    const phase2Finished = [] as [string, string][]
    try {
      for (const file of this.#backupQueue) {
        const src = join(this.instancePath, file.path)
        const dest = join(this.backupPath, file.path)

        await ensureDir(dirname(dest))
        try {
          await rename(src, dest)
        } catch (e: any) {
          // The file may have been removed between delta computation
          // and now (user race, antivirus, etc). Treat as already-gone
          // — there's nothing to back up — and continue. Any other error
          // still triggers rollback.
          if (e && e.code === 'ENOENT') {
            continue
          }
          throw e
        }
        phase2Finished.push([src, dest])
      }
    } catch (e) {
      // rollback with best effort
      this.context.logger.warn('Rollback due to backup files failed', e)
      for (const [src, dest] of phase2Finished) {
        await rename(dest, src).catch(() => undefined)
      }

      throw e
    }
    this.context.logger.log('Backup stage finished ' + phase2Finished.length)

    // phase 3, move the workspace files to instance location
    await ensureDir(this.instancePath)
    const files = [
      ...this.#linkQueue.map((f) => f.file),
      ...this.#unzipQueue.map((f) => f.file),
      ...this.#httpsQueue.map((f) => f.file),
      ...this.#readyQueue,
    ]

    const phase3Finished = [] as [string, string][]
    try {
      const dirToCreate = Array.from(
        new Set(files.map((file) => dirname(join(this.instancePath, file.path)))),
      )
      await Promise.all(dirToCreate.map((dir) => ensureDir(dir)))

      await Promise.all(
        files.map(async (file) => {
          const src = join(this.workspacePath, file.path)
          const dest = join(this.instancePath, file.path)
          await rename(src, dest)
          phase3Finished.push([src, dest])
        }),
      )
    } catch (e) {
      // rollback with best effort
      this.context.logger.warn('Rollback due to rename files failed', e)
      // Undo phase 3: move successfully renamed files back to workspace.
      for (const [src, dest] of phase3Finished) {
        await rename(dest, src).catch(() => undefined)
      }
      // Undo phase 2: move backed-up files back to the instance. Without
      // this, files from `backup-add` operations whose phase-3 rename
      // never happened would leave the instance with a missing file
      // (old version trapped in backup/, new version stranded in the
      // workspace).
      for (const [src, dest] of phase2Finished) {
        await rename(dest, src).catch(() => undefined)
      }

      throw e
    }
    this.context.logger.log('Rename stage finished ' + phase3Finished.length)

    for (const file of this.#removeQueue) {
      const dest = join(this.backupPath, file.path)
      await unlink(dest).catch(() => undefined)
      await rmdir(dirname(dest)).catch(() => undefined)
    }
    this.context.logger.log('Remove stage finished ' + this.#removeQueue.length)

    // Remove the workspace folder
    await remove(this.workspacePath)
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

    const isSpecialResource =
      file.path.startsWith('mods') ||
      file.path.startsWith('resourcepacks') ||
      file.path.startsWith('shaderpacks')
    const sha1 = file.hashes.sha1
    if (isSpecialResource) {
      this.context.onSpecialFile(file)
    }

    await this.#dispatchFileTask(file, sha1)

    if (operation === 'backup-add') {
      // backup legacy file
      this.#backupQueue.push(file)
    }
  }

  async #handleUnzip(file: InstanceFile, destination: string) {
    const zipUrl = file.downloads!.find((u) => u.startsWith('zip:'))
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
    const filePath = await this.context.getCachedResource(url.host)
    if (filePath) {
      this.#unzipQueue.push({ file, zipPath: filePath, entryName: file.path, destination })
      return true
    }
  }

  /**
   * Handle a file with http download. If the file can be handled by http, return `true`
   */
  async #handleHttp(file: InstanceFile, destination: string, sha1?: string) {
    const urls = file.downloads!.filter((u) => u.startsWith('http'))
    const peerUrl = file.downloads!.find((u) => u.startsWith('peer://'))

    if (peerUrl) {
      const url = await this.context.getPeerActualUrl(peerUrl)
      if (url) {
        urls.push(url)
      }
    }

    if (urls.length > 0) {
      // Prefer HTTP download than peer download
      this.#httpsQueue.push({
        options: {
          urls,
          destination,
          sha1,
          size: file.size,
        },
        file,
      })
      return true
    }
  }

  /**
   * Handle a file with link. If the file is existed in database, then it can be handled by link, return `true`
   */
  async #handleLink(file: InstanceFile, destination: string, sha1: string) {
    if (file.downloads && file.downloads.length > 0) {
      if (file.downloads[0].startsWith('file://')) {
        const filePath = fileURLToPath(file.downloads[0])
        const fStat = await stat(filePath).catch(() => undefined)
        if (fStat && fStat.isFile()) {
          // Verify the source file's content matches the manifest's
          // declared hash before linking. Without this check a
          // malicious modpack can use a file:// URL to read ANY file
          // the launcher process can read (e.g. ~/.ssh/id_rsa) and
          // exfiltrate it through the user's mod folder.
          const expectedSha1 = file.hashes.sha1
          if (!expectedSha1) {
            // No hash means we cannot verify the source: refuse the
            // file:// branch and fall through to other handlers.
            // (file:// without a hash is indistinguishable from a
            // bait-and-switch attack.)
            this.context.logger.warn(
              `Rejecting file:// URL for ${file.path}: no sha1 hash to verify against`,
            )
          } else {
            const actualSha1 = await this.context.worker
              .checksum(filePath, 'sha1')
              .catch(() => undefined)
            if (actualSha1 === expectedSha1) {
              this.#linkQueue.push({ file, src: filePath, destination })
              return true
            }
            this.context.logger.warn(
              `Rejecting file:// URL for ${file.path}: hash mismatch (expected ${expectedSha1}, got ${actualSha1})`,
            )
          }
        }
      }
    }

    if (!sha1) return

    const resourcePath = await this.context.getCachedResource(sha1)
    if (resourcePath) {
      this.#linkQueue.push({ file, destination, src: resourcePath })
      return true
    }
  }

  async #dispatchFileTask(file: InstanceFile, sha1: string) {
    const destination = join(this.workspacePath, file.path)

    // Check if file already exists with correct checksum
    const fStat = await stat(destination).catch(() => undefined)
    if (fStat && fStat.isFile()) {
      if (file.hashes.sha1) {
        const existingSha1 = await this.context.worker.checksum(destination, 'sha1')
        if (existingSha1 === file.hashes.sha1) {
          this.#readyQueue.push(file)
          this.finished.add(file.path)
          return
        }
      }
      if (file.hashes.crc32) {
        const existingCrc32 = await this.context.worker.checksum(destination, 'crc32')
        if (existingCrc32 === file.hashes.crc32) {
          this.#readyQueue.push(file)
          this.finished.add(file.path)
          return
        }
      }
      if (file.hashes.sha256) {
        const existingSha256 = await this.context.worker.checksum(destination, 'sha256')
        if (existingSha256 === file.hashes.sha256) {
          this.#readyQueue.push(file)
          this.finished.add(file.path)
          return
        }
      }
    }

    // The workspace copy is missing or its content does not match the
    // expected hash. Drop any stale "finished" marker that may have
    // been seeded from `.install-profile.finishedPath` — otherwise the
    // phase-1 link/download/unzip helpers will skip this file (because
    // they short-circuit on `finished.has`) and phase 3 will then fail
    // trying to rename a workspace file that was never re-materialised.
    this.finished.delete(file.path)

    if (await this.#handleLink(file, destination, sha1)) return

    // An empty `downloads` array is just as unresolvable as a missing one.
    // Accessing `downloads[0]` on it used to crash `#handleLink`; now it
    // falls through to here and is reported as unresolvable instead.
    if (!file.downloads || file.downloads.length === 0) {
      this.unresolvable.push(file)
      return
    }

    if (await this.#handleUnzip(file, destination)) return

    if (await this.#handleHttp(file, destination, sha1)) return

    this.unresolvable.push(file)
  }
}
