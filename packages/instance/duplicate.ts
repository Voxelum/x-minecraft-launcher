import { copyFile, ensureDir, link, stat } from 'fs-extra'
import { join, resolve } from 'path'
import { getInstanceFiles } from './files_discovery'
import { Logger } from './internal_type'
import { shouldBeExcluded } from './manifest_generation'

export interface DuplicateInstanceTrackerEvents {
  'duplicate.progress': { progress: { progress: number; total: number } }
}

export interface DuplicateInstanceOptions {
  instancePath: string
  newPath: string
  logger?: Logger
  signal?: AbortSignal
  tracker?: <E extends { phase: keyof DuplicateInstanceTrackerEvents; payload: DuplicateInstanceTrackerEvents[keyof DuplicateInstanceTrackerEvents] }>(event: E) => void
}

export async function duplicateInstance(options: DuplicateInstanceOptions): Promise<void> {
  const { instancePath, newPath, logger, signal, tracker } = options

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new Error('aborted')
    }
  }

  const files = await getInstanceFiles(instancePath, logger, (filePath, fstat) => {
    if (shouldBeExcluded(filePath, fstat)) {
      return true
    }
    return false
  })

  throwIfAborted()

  const isSameDisk = (await stat(instancePath)).dev === (await stat(newPath)).dev

  const progress = { progress: 0, total: files.length }
  tracker?.({ phase: 'duplicate.progress', payload: { progress } })

  const linkOrCopy = isSameDisk
    ? async (src: string, dest: string) =>
        link(src, dest)
          .catch(() => copyFile(src, dest))
          .then(() => {
            progress.progress++
          })
    : async (src: string, dest: string) => {
        await copyFile(src, dest)
        progress.progress++
      }

  // Accumulate per-file failures instead of letting each rejected
  // promise bubble out as an unhandledRejection (the uncaught_error
  // plugin turns those into one trackException per file — see
  // telemetry where a single duplicate of an instance with ~850
  // stale manifest entries produced 850 raw `Error: ENOENT
  // copyfile …` events on 0.56.7). We tolerate ENOENT silently
  // (stale entries in the source's `instance.files.json` whose real
  // files were already deleted), and aggregate every other failure
  // into a single typed warning at the end.
  const missingSources: string[] = []
  const otherFailures: Array<{ src: string; err: unknown }> = []
  const safe = (src: string, p: Promise<void>) => p.catch((e: any) => {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
      missingSources.push(src)
      return
    }
    otherFailures.push({ src, err: e })
  })

  const promises = [] as Promise<void>[]

  for (const [file] of files) {
    throwIfAborted()
    const src = join(instancePath, file.path)
    const dest = join(newPath, file.path)
    await ensureDir(resolve(dest, '..'))
    if (
      file.path.startsWith('mods/') ||
      file.path.startsWith('resourcepacks/') ||
      file.path.startsWith('shaderpacks/')
    ) {
      promises.push(safe(src, linkOrCopy(src, dest)))
    } else {
      promises.push(safe(src, copyFile(src, dest).then(() => { progress.progress++ })))
    }
  }

  await Promise.all(promises)

  if (missingSources.length > 0) {
    logger?.warn(
      `duplicateInstance: skipped ${missingSources.length} missing source file(s) (stale manifest entries). First: ${missingSources[0]}`,
    )
  }
  if (otherFailures.length > 0) {
    const err = new Error(
      `duplicateInstance partially failed: ${otherFailures.length} file(s) could not be copied. First: ${otherFailures[0].src}`,
    ) as Error & { failures: typeof otherFailures }
    err.name = 'InstanceDuplicatePartialError'
    err.failures = otherFailures
    throw err
  }
}
