import { InstanceFile } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { openEntryReadStream } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { ensureDir, stat } from 'fs-extra'
import { dirname } from 'path'
import { pipeline } from 'stream/promises'
import { errors } from 'undici'
import { Entry, ZipFile } from 'yauzl'
import { isSystemError } from '~/util/error'
import { ZipManager } from '~/zipManager/ZipManager'

export class UnzipFileTask extends AbortableTask<void> {
  #abortController = new AbortController()

  constructor(
    private zipManager: ZipManager,
    private queue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }>,
    readonly finished: Set<string>,
  ) {
    super()
    this.name = 'unzip'
    this.param = { count: queue.length }
  }

  async #processEntry(zip: ZipFile, entry: Entry, destination: string) {
    await ensureDir(dirname(destination))
    const fstat = await stat(destination).catch(() => undefined)
    if (fstat && entry.uncompressedSize === fstat.size) {
      this._progress += entry.uncompressedSize
      return
    }
    const stream = await openEntryReadStream(zip, entry)
    this.update(0)
    stream.on('data', (chunk) => {
      this._progress += chunk.length
      this.update(chunk.length)
    })
    this.#abortController.signal.addEventListener('abort', () => {
      stream.destroy(new Error('Aborted'))
    })
    await pipeline(stream, createWriteStream(destination))
  }

  protected async process(): Promise<void> {
    this.#abortController = new AbortController()
    const queue = this.queue

    // Update the total size
    for (const { zipPath, entryName } of queue) {
      const zip = await this.zipManager.open(zipPath).catch(e => {
        if (isSystemError(e) && e.code === 'ENOENT') {
          e.name = 'UnzipFileNotFoundError'
        }
        throw e
      })
      const entry = zip.entries[entryName]
      if (entry) {
        this._total += entry.uncompressedSize
      }
    }

    const allErrors: any[] = []
    const zipsToClose = [] as ZipFile[]
    // process by 128 entry per chunk
    for (let i = 0; i < queue.length; i += 128) {
      const promises = [] as Promise<unknown>[]
      for (const { zipPath, entryName, destination, file } of queue.slice(i, i + 128)) {
        const { file: zip, entries } = await this.zipManager.open(zipPath)
        zipsToClose.push(zip)
        const entry = entries[entryName]
        if (entry) {
          promises.push(this.#processEntry(zip, entry, destination).then(() => {
            this.finished.add(file.path)
          }, (e) => {
            return Object.assign(e, {
              zipEntry: entry,
              zipPath,
            })
          }))
        }
      }
      await Promise.all(promises)
      const errors = (await Promise.all(promises)).filter(e => !!e)
      allErrors.push(...errors)
    }

    for (const zip of zipsToClose) {
      zip.close()
    }

    if (allErrors.length > 0) {
      if (allErrors.length > 1) {
        throw new AggregateError(allErrors.flatMap(e => e instanceof AggregateError ? e.errors : e))
      }

      throw allErrors[0]
    }
  }

  protected abort(isCancelled: boolean): void {
    this.#abortController.abort()
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}
