import { createWriteStream, promises } from 'fs'
import { ensureFile, stat } from 'fs-extra'
import { join } from 'path'
import { Writable } from 'stream'
import { promisify } from 'util'
import { ZipFile } from 'yazl'
import { gunzip as _gunzip, gzip as _gzip } from 'zlib'
import { pipeline } from './fs'
import { Tracker, onProgress } from '@xmcl/installer'

export const gunzip: (data: Buffer) => Promise<Buffer> = promisify(_gunzip)
export const gzip: (data: Buffer) => Promise<Buffer> = promisify(_gzip)

export interface ZipTrackerEvents {
  'zip.progress': { progress: { progress: number; total: number }; destination: string }
}

/**
 * Recursively include a directory or file into a zip file
 * @param zipFile The zip file to add to
 * @param realPath The real directory or file absolute path
 * @param zipPath The relative zip path that the real path files will be zipped to
 */
export async function includeAs(zipFile: ZipFile, realPath: string, zipPath = ''): Promise<void> {
  const fstat = await stat(realPath)
  if (fstat.isDirectory()) {
    const files = await promises.readdir(realPath)
    if (zipPath !== '') {
      zipFile.addEmptyDirectory(zipPath)
    }
    await Promise.all(files.map(name => includeAs(zipFile, join(realPath, name), `${zipPath}/${name}`)))
  } else if (fstat.isFile()) {
    zipFile.addFile(realPath, zipPath)
  }
}

/**
 * Execute the zip and write to the destination file
 * @param zipFile The zip file to write
 * @param destination The destination file path
 * @param signal Optional AbortSignal for cancellation
 * @param tracker Optional tracker for progress reporting
 */
export async function writeZipFile(
  zipFile: ZipFile,
  destination: string,
  signal?: AbortSignal,
  tracker?: Tracker<ZipTrackerEvents>,
): Promise<void> {
  if (signal?.aborted) {
    throw new Error('Operation aborted')
  }

  await ensureFile(destination)
  const writeStream: Writable = createWriteStream(destination)

  const progress = onProgress(tracker, 'zip.progress', { destination })

  const abortHandler = () => {
    zipFile.outputStream.unpipe()
    writeStream.destroy(new Error('Operation aborted'))
  }

  signal?.addEventListener('abort', abortHandler, { once: true })

  try {
    zipFile.outputStream.on('data', (buffer) => {
      progress.progress += buffer.length
    })
    const pipelinePromise = pipeline(zipFile.outputStream, writeStream)
    const fileClose = new Promise<void>((resolve, reject) => {
      writeStream.on('close', resolve)
      writeStream.on('error', reject)
    })
    zipFile.end({ forceZip64Format: false }, (...args: any[]) => {
      progress.total = args[0]
    })
    await Promise.all([fileClose, pipelinePromise])
  } finally {
    signal?.removeEventListener('abort', abortHandler)
  }
}
