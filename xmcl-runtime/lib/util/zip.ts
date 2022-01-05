import { path7za } from '7zip-bin'
import { unpack } from '7zip-min'
import { AbortableTask, BaseTask, CancelledError } from '@xmcl/task'
import { spawn } from 'child_process'
import { createWriteStream, promises } from 'fs'
import { ensureFile, stat } from 'fs-extra'
import { join } from 'path'
import { Writable } from 'stream'
import { promisify } from 'util'
import { DirectoryOptions, Options, ReadStreamOptions, ZipFile } from 'yazl'
import { gunzip as _gunzip, gzip as _gzip } from 'zlib'
import { pipeline } from './fs'

export const gunzip: (data: Buffer) => Promise<Buffer> = promisify(_gunzip)
export const gzip: (data: Buffer) => Promise<Buffer> = promisify(_gzip)

export class ZipTask extends AbortableTask<void> {
  private writeStream: Writable | undefined

  constructor(readonly destination: string, readonly zipFile: ZipFile = new ZipFile()) {
    super()
    this._to = destination
  }

  /**
   * Include `realPath` as `zipPath` in to the zip file. The `realPath` is the directory
   * @param realPath The real directory absolute path
   * @param zipPath The relative zip path that the real path files will be zipped
   */
  async includeAs(realPath: string, zipPath = '') {
    const fstat = await stat(realPath)
    if (fstat.isDirectory()) {
      const files = await promises.readdir(realPath)
      if (zipPath !== '') {
        this.zipFile.addEmptyDirectory(zipPath)
      }
      await Promise.all(files.map(name => this.includeAs(join(realPath, name), `${zipPath}/${name}`)))
    } else if (fstat.isFile()) {
      this.zipFile.addFile(realPath, zipPath)
    }
  }

  addFile(realPath: string, metadataPath: string, options?: Partial<Options>): void {
    this.zipFile.addFile(realPath, metadataPath, options)
  }

  addReadStream(input: NodeJS.ReadableStream, metadataPath: string, options?: Partial<ReadStreamOptions>): void {
    this.zipFile.addReadStream(input, metadataPath, options)
  }

  addBuffer(buffer: Buffer, metadataPath: string, options?: Partial<Options>): void {
    this.zipFile.addBuffer(buffer, metadataPath, options)
  }

  addEmptyDirectory(metadataPath: string, options?: Partial<DirectoryOptions>): void {
    this.zipFile.addEmptyDirectory(metadataPath, options)
  }

  protected async process(): Promise<void> {
    if (!this.writeStream) {
      await ensureFile(this.destination)
      this.writeStream = createWriteStream(this.destination)
    }
    this.zipFile.outputStream.on('data', (buffer) => {
      this._progress += buffer.length
      this.update(buffer.length)
    })
    const promise = pipeline(this.zipFile.outputStream, this.writeStream)
    if (!(this.zipFile as any).ended) {
      await new Promise<void>((resolve) => {
        this.zipFile.end({ forceZip64Format: false }, (...args: any[]) => {
          this._total = args[0]
          resolve()
        })
      })
    }
    await promise
  }

  protected isAbortedError(e: any): boolean {
    return false
  }

  protected async abort(isCancelled: boolean): Promise<void> {
    if (isCancelled) {
      this.zipFile.outputStream.unpipe()
      this.writeStream?.destroy(new CancelledError())
    } else {
      this.zipFile.outputStream.pause()
    }
  }
}

export function unpack7z(archivePath: string, destinationDirectory: string) {
  return new Promise<void>((resolve, reject) => {
    unpack(archivePath, destinationDirectory, (e) => { if (e) reject(e); else resolve() })
  })
}

export function extractLzma(lzmaFilePath: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(path7za, ['-y', '-aoa', lzmaFilePath])
    // let output = '';
    proc.on('error', function (err) {
      reject(err)
    })
    proc.on('exit', function (code) {
      if (code) {
        reject(new Error('Exited with code ' + code))
      } else {
        resolve()
      }
    })
    // proc.stdout.on('data', (chunk) => {
    //   output += chunk.toString();
    // });
  })
}
