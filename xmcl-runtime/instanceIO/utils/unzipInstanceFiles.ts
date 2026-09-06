import { InstanceFile, getInstanceFileChecksum } from '@xmcl/instance'
import { Tracker, onProgress } from '@xmcl/installer'
import { openEntryReadStream } from '@xmcl/unzip'
import { WorkerQueue, isSystemError } from '@xmcl/utils'
import { createWriteStream } from 'fs'
import { ensureDir } from 'fs-extra'
import { dirname } from 'path'
import { pipeline } from 'stream/promises'
import { Entry, ZipFile } from '@xmcl/yauzl'
import { ZipManager } from '~/infra'
import { InstallInstanceTrackerEvents } from '@xmcl/runtime-api'
import { Crc32 } from '@aws-crypto/crc32'
import { createHash } from 'crypto'
import { assertInstanceFileChecksum } from './verifyInstanceFile'

async function processEntry(
  zip: ZipFile,
  entry: Entry,
  file: InstanceFile,
  destination: string,
  signal: AbortSignal,
  progress: { progress: number; total: number },
) {
  signal.throwIfAborted()
  await ensureDir(dirname(destination))
  signal.throwIfAborted()
  const stream = await openEntryReadStream(zip, entry)
  const checksum = new Crc32()
  const expected = getInstanceFileChecksum(file)
  const hash = expected && expected.algorithm !== 'crc32' ? createHash(expected.algorithm) : undefined
  stream.on('data', (chunk) => {
    checksum.update(chunk)
    hash?.update(chunk)
    progress.progress += chunk.length
  })
  await pipeline(stream, createWriteStream(destination), { signal })
  const actual = checksum.digest()
  if (actual !== entry.crc32) {
    throw Object.assign(new Error(`Checksum mismatch for ZIP entry: ${entry.fileName}`), {
      name: 'ChecksumNotMatchError',
      file: destination,
      expect: String(entry.crc32),
      actual: String(actual),
    })
  }
  if (expected) assertInstanceFileChecksum(expected, destination, hash ? hash.digest('hex') : String(actual))
}

/**
 * Unzip instance files from zip archives with progress tracking.
 */
export async function unzipInstanceFiles(
  zipManager: ZipManager,
  queue: Array<{ file: InstanceFile; zipPath: string; entryName: string; destination: string }>,
  finished: Set<string>,
  signal: AbortSignal,
  tracker?: Tracker<InstallInstanceTrackerEvents>,
): Promise<void> {
  const progress = onProgress(tracker, 'install-instance.unzip', { count: queue.length })
  const allErrors: any[] = []
  const workerQueue = new WorkerQueue<{
    file: InstanceFile
    zipPath: string
    entryName: string
    destination: string
  }>(
    async ({ file, zipPath, entryName, destination }) => {
      signal.throwIfAborted()
      const { file: zip, entries } = await zipManager.open(zipPath)
      const entry = entries[entryName]
      if (!entry) {
        throw Object.assign(new Error(`Missing ZIP entry: ${entryName}`), { zipPath, entryName })
      } else {
        try {
          await processEntry(zip, entry, file, destination, signal, progress)
          finished.add(file.path)
        } catch (e) {
          Object.assign(e as any, {
            zipEntry: entry,
            zipPath,
          })
          throw e
        }
      }
    },
    // A ZipFile is shared by all jobs from an archive. Hundreds of concurrent
    // streams can exhaust handles and race archive lifecycle; 16 still keeps
    // extraction parallel while leaving room for download and filesystem work.
    16,
    {
      shouldRetry: (e) => false,
    },
  )
  workerQueue.onerror = (job, e) => {
    allErrors.push(e)
  }

  // Update the total size
  for (const { zipPath, entryName } of queue) {
    signal.throwIfAborted()
    const zip = await zipManager.open(zipPath).catch((e) => {
      if (isSystemError(e) && e.code === 'ENOENT') {
        e.name = 'UnzipFileNotFoundError'
      }
      throw e
    })
    const entry = zip.entries[entryName]
    if (entry) {
      progress.total += entry.uncompressedSize
    }
  }

  for (const job of queue) workerQueue.push(job)

  await new Promise<void>((resolve) => {
    workerQueue.onIdle = () => resolve()
  })

  if (allErrors.length === 1) {
    throw allErrors[0]
  }

  if (allErrors.length > 1) {
    throw new AggregateError(allErrors.flatMap((e) => (e instanceof AggregateError ? e.errors : e)))
  }
}
