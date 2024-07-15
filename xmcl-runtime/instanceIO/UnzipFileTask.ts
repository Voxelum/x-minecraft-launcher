import { InstanceFile } from '@xmcl/runtime-api'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { ensureDir, stat } from 'fs-extra'
import { dirname } from 'path'
import { pipeline } from 'stream/promises'
import { Entry, ZipFile } from 'yauzl'

export async function unzip(
  queue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }>,
  onProgress: (chunk: number, progress: number, total: number) => void,
  signal?: AbortSignal,
) {
  async function processEntry(zip: ZipFile, entry: Entry, destination: string) {
    total += entry.uncompressedSize
    onProgress(0, progress, total)

    await ensureDir(dirname(destination))
    const fstat = await stat(destination).catch(() => undefined)
    if (fstat && entry.uncompressedSize === fstat.size) {
      return
    }
    const stream = await openEntryReadStream(zip, entry)
    stream.on('data', (chunk) => {
      progress += chunk.length
      onProgress(chunk.length, progress, total)
    })
    await pipeline(stream, createWriteStream(destination))
  }

  if (signal) {
    signal.onabort = () => {
      for (const [zipPath, [zip]] of Object.entries(zipInstances)) {
        zip.close()
      }
    }
  }

  let total = 0
  let progress = 0
  const zipInstances: Record<string, [ZipFile, Record<string, Entry>]> = {}
  const zips = new Set(queue.map((q) => q.zipPath))
  for (const zip of zips) {
    const zipInstance = await open(zip)
    const array = await readAllEntries(zipInstance)
    const reocrd = array.reduce((acc, cur) => {
      acc[cur.fileName] = cur
      return acc
    }, {} as Record<string, Entry>)
    zipInstances[zip] = [zipInstance, reocrd]
  }

  const promises = [] as Promise<unknown>[]
  for (const { zipPath, entryName, destination } of queue) {
    const [zip, entries] = zipInstances[zipPath]
    const entry = entries[entryName]
    if (entry) {
      promises.push(processEntry(zip, entry, destination).catch((e) => {
        return Object.assign(e, {
          zipEntry: entry,
          zipPath,
        })
      }))
    }
  }
  const errors = (await Promise.all(promises)).filter(e => !!e)

  for (const [zipPath, [zip]] of Object.entries(zipInstances)) {
    zip.close()
  }

  onProgress(0, progress, total)

  if (errors.length > 0) {
    if (errors.length > 1) {
      throw new AggregateError(errors)
    }

    throw errors[0]
  }
}
