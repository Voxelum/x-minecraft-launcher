import { InstanceFile } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { ensureDir, stat } from 'fs-extra'
import { dirname } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { errors } from 'undici'
import { Entry, ZipFile } from 'yauzl'

export class UnzipFileTask extends AbortableTask<void> {
  #zipInstances: Record<string, [ZipFile, Record<string, Entry>]> = {}

  constructor(private queue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }>,
    readonly finished: Set<InstanceFile>,
    readonly interpreter: (input: Readable, file: string) => void = () => { },
  ) {
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
    this.interpreter(stream, destination)
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

    const allErrors: any[] = []
    // process by 128 entry per chunk
    for (let i = 0; i < queue.length; i += 128) {
      const promises = [] as Promise<unknown>[]
      for (const { zipPath, entryName, destination, file } of queue.slice(i, i + 128)) {
        const [zip, entries] = this.#zipInstances[zipPath]
        const entry = entries[entryName]
        if (entry) {
          promises.push(this.#processEntry(zip, entry, destination).then(() => {
            this.finished.add(file)
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

    for (const [zipPath, [zip]] of Object.entries(this.#zipInstances)) {
      zip.close()
    }

    if (allErrors.length > 0) {
      if (allErrors.length > 1) {
        throw new AggregateError(allErrors)
      }

      throw allErrors[0]
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
