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
      promises.push(linkOrCopy(src, dest))
    } else {
      promises.push(copyFile(src, dest).then(() => { progress.progress++ }))
    }
  }

  await Promise.allSettled(promises)
}
