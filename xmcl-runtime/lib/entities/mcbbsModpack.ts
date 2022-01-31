import { DownloadTask, installCurseforgeFileTask } from '@xmcl/installer'
import { joinUrl } from '@xmcl/installer/http/utils'
import { McbbsModpackManifest, ModpackFileInfoAddon, ModpackFileInfoCurseforge } from '@xmcl/runtime-api'
import { BaseTask, CancelledError, task } from '@xmcl/task'
import { open, openEntryReadStream, readAllEntries, readEntry, walkEntriesGenerator } from '@xmcl/unzip'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { Entry, ZipFile } from 'yauzl'
import { pipeline } from '../util/fs'

/**
 * Read the metadata of the modpack
 * @param zip The modpack zip
 * @returns The MCBBS modpack metadata
 */
export async function readMCBBSModpackMetadata(zip: ZipFile) {
  for await (const entry of walkEntriesGenerator(zip)) {
    if (entry.fileName === 'mcbbs.packmeta') {
      return readEntry(zip, entry).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
    }
  }
  throw new Error()
}

export interface InstallMcbbsModpackOptions {
  path: string
  destination: string

  manifest?: McbbsModpackManifest
  /**
   * Allow to download the file from custom file api
   */
  allowCustomFile?: boolean
}

export function installMcbbsModpackTask(options: InstallMcbbsModpackOptions) {
  return task('installMcbbsModpack', async function () {
    const manifest = options.manifest ?? await this.yield(new InstallMCBBSModpackTask(options.path, options.destination).setName('unzip'))
    if (manifest.files && manifest.files.length > 0) {
      const curseforgeFiles = manifest.files.filter((f): f is ModpackFileInfoCurseforge => f.type === 'curse')
      await this.all(curseforgeFiles.map((f) => installCurseforgeFileTask(f, join(options.destination, 'mods')).setName('downloadCurseforge')))

      if (manifest.fileApi && options.allowCustomFile) {
        const fileApi = manifest.fileApi
        const addonFiles = manifest.files.filter((f): f is ModpackFileInfoAddon => f.type === 'addon')
        await this.all(addonFiles.map((f) => new DownloadTask({
          url: joinUrl(fileApi, f.path),
          destination: join(options.destination, f.path),
          validator: {
            algorithm: 'sha1',
            hash: f.hash,
          },
        }).setName('downloadAddon')))
      }
    }
  })
}

/**
 * This task will install MCBBS files into the destination directory.
 *
 * It will not handle the MCBBS version or auto-update function.
 */
export class InstallMCBBSModpackTask extends BaseTask<McbbsModpackManifest> {
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

  protected async runTask(): Promise<McbbsModpackManifest> {
    const [zip, entries] = await this.ensureZip()
    const destination = this._to!
    const manifestEntry = entries.find(e => e.fileName === 'mcbbs.packmeta')
    if (manifestEntry) {
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
      const metadata = await readEntry(zip, manifestEntry).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
      return metadata
    }
    throw new Error('Malformed MCBBS Modpack!')
  }

  protected async cancelTask(): Promise<void> {
    for (const stream of this.openedStreams) {
      stream.destroy(new CancelledError())
    }
  }

  protected async pauseTask(): Promise<void> {
    for (const stream of this.openedStreams) {
      stream.pause()
    }
  }

  protected async resumeTask(): Promise<void> {
    for (const stream of this.openedStreams) {
      stream.resume()
    }
  }
}
