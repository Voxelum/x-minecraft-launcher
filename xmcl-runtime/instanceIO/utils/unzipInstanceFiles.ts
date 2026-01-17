import { InstanceFile } from '@xmcl/instance'
import { Tracker, onProgress } from '@xmcl/installer'
import { openEntryReadStream } from '@xmcl/unzip'
import { WorkerQueue, isSystemError } from '@xmcl/utils'
import { createWriteStream } from 'fs'
import { ensureDir, stat } from 'fs-extra'
import { dirname } from 'path'
import { pipeline } from 'stream/promises'
import { Entry, ZipFile } from 'yauzl'
import { ZipManager } from '~/infra'
import { InstallInstanceTrackerEvents } from '@xmcl/runtime-api'

async function processEntry(
  zip: ZipFile,
  entry: Entry,
  destination: string,
  signal: AbortSignal,
  progress: { progress: number; total: number },
) {
  await ensureDir(dirname(destination))
  const fstat = await stat(destination).catch(() => undefined)
  if (fstat && entry.uncompressedSize === fstat.size) {
    progress.progress += entry.uncompressedSize
    return
  }
  const stream = await openEntryReadStream(zip, entry)
  stream.on('data', (chunk) => {
    progress.progress += chunk.length
  })
  signal.addEventListener('abort', () => {
    stream.destroy(signal.reason)
  })
  await pipeline(stream, createWriteStream(destination))
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
  const zipsToClose = new Set<ZipFile>()
  const workerQueue = new WorkerQueue<{
    file: InstanceFile
    zipPath: string
    entryName: string
    destination: string
  }>(
    async ({ file, zipPath, entryName, destination }) => {
      const { file: zip, entries } = await zipManager.open(zipPath)
      zipsToClose.add(zip)
      const entry = entries[entryName]
      if (entry) {
        try {
          await processEntry(zip, entry, destination, signal, progress)
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
    128,
    {
      shouldRetry: (e) => false,
    },
  )
  workerQueue.onerror = (job, e) => {
    allErrors.push(e)
  }

  // Update the total size
  for (const { zipPath, entryName } of queue) {
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

  for (const zip of zipsToClose) {
    zip.close()
  }

  if (allErrors.length === 1) {
    throw allErrors[0]
  }

  if (allErrors.length > 1) {
    throw new AggregateError(allErrors.flatMap((e) => (e instanceof AggregateError ? e.errors : e)))
  }
}
