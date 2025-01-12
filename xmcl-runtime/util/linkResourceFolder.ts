import { ensureDir, lstat, readdir, readlink, rename, unlink } from 'fs-extra'
import { Logger } from '~/logger'
import { isSystemError } from './error'
import { ENOENT_ERROR, linkDirectory } from './fs'
import { sep } from 'path'

export function readlinkSafe(path: string) {
  return readlink(path).catch(e => {
    if (isSystemError(e) && (e.code === ENOENT_ERROR || e.code === 'EINVAL' || e.code === 'EISDIR')) {
      return undefined
    }
    if (!e.stack) {
      e.stack = new Error().stack
    }
    throw e
  })
}

export async function readdirSafe(path: string) {
  return await readdir(path).catch(e => {
    if (isSystemError(e) && e.code === ENOENT_ERROR) {
      return []
    }
    if (!e.stack) {
      e.stack = new Error().stack
    }
    throw e
  })
}

export async function isLinked(srcPath: string, destPath: string) {
  const linkedPath = await readlinkSafe(destPath)
  return linkedPath === srcPath || linkedPath === srcPath + sep
}
/**
 * Try to link folder as symbolic link to the resource folder.
 * @return `true` if linked, `false` means dictionary
 */
export async function tryLink(srcPath: string, destPath: string, logger: Logger, isManaged: (path: string) => boolean) {
  logger.log(`Linking the at domain to ${destPath}`)
  const stat = await lstat(destPath).catch((e) => {
    if (isSystemError(e) && e.code === ENOENT_ERROR) {
      return
    }
    throw e
  })
  if (stat) {
    if (stat.isSymbolicLink()) {
      if (await readlink(destPath) === srcPath) {
        logger.log(`Skip linking the at domain as it already linked: ${destPath}`)
        return true
      }
      logger.log(`Relink the domain: ${destPath}`)
      await unlink(destPath)
    } else {
      // Skip for directory
      if (stat.isDirectory()) {
        return false
      } else {
        await rename(destPath, `${destPath}_backup`)
      }
    }
  } else if (!isManaged(destPath)) {
    // do not link if this is not an managed instance
    await ensureDir(destPath)
    return false
  }

  await linkDirectory(srcPath, destPath, logger)
  return true
}
