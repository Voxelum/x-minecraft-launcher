import { CancelledError, TaskBase } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries, readEntry, walkEntriesGenerator } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { Readable } from 'node:stream'
import { join } from 'path'
import { Entry, ZipFile } from 'yauzl'
import { pipeline } from '../util/fs'
import { HMCLModpack, HMCLServerManagedModpack, HMCLVersion } from '/@shared/entities/hmclModpack'

/**
 * Read the metadata of the modpack
 * @param zip The modpack zip
 * @returns The HMCL modpack metadata
 */
export async function readHMCLModpackMetadata(zip: ZipFile) {
  for await (const entry of walkEntriesGenerator(zip)) {
    if (entry.fileName === 'server-manifest.json') {
      return readEntry(zip, entry).then(b => JSON.parse(b.toString()) as HMCLServerManagedModpack)
    }
  }
  throw new Error()
}

export function resolveHMCLVersion(version: HMCLVersion) {
}

/**
 * This task will install HMCL files into the destination directory.
 *
 * It will not handle the HMCL version or auto-update function.
 */
export class InstallHMCLModpackTask extends TaskBase<HMCLServerManagedModpack> {
  private zip: ZipFile | undefined
  private entries: (Entry[]) | undefined = []
  private openedStreams: Readable[] = []

  constructor(path: string, destination: string) {
    super()
    this._from = path
    this._to = destination
  }

  protected async ensureZip() {
    if (this.zip && this.entries) {
      return [this.zip, this.entries] as const
    }
    this.zip = await open(this._from!)
    this.entries = await readAllEntries(this.zip)

    return [this.zip, this.entries] as const
  }

  protected async track(readStream: Readable) {
    readStream.on('data', (b) => { this.update(b.length) })
    this.openedStreams.push(readStream)
  }

  protected async run(): Promise<HMCLServerManagedModpack> {
    const [zip, entries] = await this.ensureZip()
    const destination = this._to!
    if (entries.find(e => e.fileName === 'server-manifest.json')) {
      const promises = [] as Array<Promise<void>>
      const fileEntries = entries.filter(e => e.fileName.startsWith('overrides'))
      this._total = fileEntries.map(e => e.uncompressedSize).reduce((a, b) => a + b, 0)
      for (const e of fileEntries) {
        const fileName = join(destination, e.fileName.substring('overrides/'.length, e.fileName.length))
        const readStream = await openEntryReadStream(zip, e)
        this.track(readStream)
        promises.push(pipeline(readStream, createWriteStream(fileName)))
      }
      await Promise.all(promises)
      const metadata = await readEntry(zip, entries.find(e => e.fileName === 'server-manifest.json')!).then(b => JSON.parse(b.toString()) as HMCLServerManagedModpack)
      return metadata
    }
    throw new Error('Malformed HMCL Modpack!')
  }

  protected async performCancel(): Promise<void> {
    for (const stream of this.openedStreams) {
      stream.destroy(new CancelledError(undefined))
    }
  }

  protected async performPause(): Promise<void> {
    for (const stream of this.openedStreams) {
      stream.pause()
    }
  }

  protected performResume(): void {
    for (const stream of this.openedStreams) {
      stream.resume()
    }
  }
}
