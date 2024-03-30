import { InstanceFile } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { ensureDir, stat } from 'fs-extra'
import { dirname } from 'path'
import { pipeline } from 'stream/promises'
import { errors } from 'undici'
import { Entry, ZipFile } from 'yauzl'

export class UnzipFileTask extends AbortableTask<void> {
  #zipInstances: Record<string, [ZipFile, Record<string, Entry>]> = {}

  constructor(private queue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }>) {
    super()
    this.name = 'unzip'
    this.param = { count: queue.length }
  }

  async #processEntry(zip: ZipFile, entry: Entry, destination: string) {
    await ensureDir(dirname(destination))
    const fstat = await stat(destination).catch(() => undefined)
    if (fstat && entry.uncompressedSize === fstat.size) {
      return
    }
    const stream = await openEntryReadStream(zip, entry)
    this._total += entry.uncompressedSize
    this.update(0)
    stream.on('data', (chunk) => {
      this._progress += chunk.length
      this.update(chunk.length)
    })
    await pipeline(stream, createWriteStream(destination))
  }

  protected async process(): Promise<void> {
    const queue = this.queue
    const zips = new Set(queue.map((q) => q.zipPath))
    for (const zip of zips) {
      const zipInstance = await open(zip)
      const array = await readAllEntries(zipInstance)
      const reocrd = array.reduce((acc, cur) => {
        acc[cur.fileName] = cur
        return acc
      }, {} as Record<string, Entry>)
      this.#zipInstances[zip] = [zipInstance, reocrd]
    }

    const promises = [] as Promise<unknown>[]
    for (const { zipPath, entryName, destination } of queue) {
      const [zip, entries] = this.#zipInstances[zipPath]
      const entry = entries[entryName]
      if (entry) {
        promises.push(this.#processEntry(zip, entry, destination).catch((e) => {
          return Object.assign(e, {
            zipEntry: entry,
            zipPath,
          })
        }))
      }
    }
    const errors = (await Promise.all(promises)).filter(e => !!e)

    for (const [zipPath, [zip]] of Object.entries(this.#zipInstances)) {
      zip.close()
    }

    if (errors.length > 0) {
      if (errors.length > 1) {
        throw new AggregateError(errors)
      }

      throw errors[0]
    }
  }

  protected abort(isCancelled: boolean): void {
    for (const [zipPath, [zip]] of Object.entries(this.#zipInstances)) {
      zip.close()
    }
  }

  protected isAbortedError(e: any): boolean {
    return e instanceof errors.RequestAbortedError
  }
}
