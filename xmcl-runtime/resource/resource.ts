import { Persisted, Resource } from '@xmcl/runtime-api'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureFile, rename, stat } from 'fs-extra'
import { basename, dirname, extname, join } from 'path'
import { linkOrCopy } from '~/util/fs'

// resource functions

/**
 * Create a resource builder from source.
 */

export function getCurseforgeUrl(project: number, file: number): string {
  return `curseforge://id/${project}/${file}`
}
export function getGithubUrl(owner: string, repo: string, release: string) {
  return `https://api.github.com/repos/${owner}/${repo}/releases/assets/${release}`
}

export function getStoragePath(resolved: Resource, root: string) {
  const fileName = filenamify(resolved.fileName, { replacement: '-' })
  const filePath = join(root, resolved.domain, fileName)
  return filePath
}

/**
 * Persist a resource to disk. This will try to copy or link the resource file to domain directory, or rename it if it's already in domain directory.
 *
 * Notice the return persisted resource will set `path` to the `storePath`
 *
 * @param resolved The resolved resource
 * @param root The root of the persistence storage
 */
export async function persistResource(resolved: Resource, root: string, pending: Set<string>): Promise<Persisted<Resource>> {
  let fileName = filenamify(resolved.fileName, { replacement: '-' })
  let filePath = join(root, resolved.domain, fileName)

  const existed = existsSync(filePath)
  const alreadyStored = existed ? (await stat(filePath)).ino === resolved.ino : false

  if (!alreadyStored) {
    if (existed) {
      // fileName conflict
      fileName = filenamify(`${resolved.name}.${resolved.hash.slice(0, 6)}${extname(resolved.fileName)}`)
      filePath = join(root, resolved.domain, fileName)
    }

    // skip to handle the file if it's inside the resource dir
    pending.add(filePath)
    await ensureFile(filePath)
    if (dirname(resolved.path) === dirname(filePath)) {
      // just rename if they are in same dir
      await rename(resolved.path, filePath)
    } else {
      await linkOrCopy(resolved.path, filePath)
    }
  }

  const fileStatus = await stat(filePath)
  return {
    ...resolved,
    path: filePath,
    ino: fileStatus.ino,
    size: fileStatus.size,
    storedPath: filePath,
  }
}

// resource class

export function getResourceFileName(filePath: string) {
  const base = basename(filePath)
  if (base.endsWith('.pending')) {
    return base.substring(0, base.indexOf('.pending'))
  }
  return base
}
