import { checksum } from '@xmcl/core'
import { isFileNoFound } from '@xmcl/runtime-api'
import { AnyError, isSystemError } from '@xmcl/utils'
import { isWindowsReservedName } from '@xmcl/instance'
import { createHash } from 'crypto'
import { constants, existsSync } from 'fs'
import { access, close, copyFile, ensureDir, ensureFile, link, open, read, readdir, stat, symlink, unlink } from 'fs-extra'
import { platform } from 'os'
import { join, resolve } from 'path'
import { Readable, pipeline } from 'stream'
import { promisify } from 'util'
import { Logger } from '~/infra'

const pip = promisify(pipeline)

export { checksum, pip as pipeline }

export function isPathDiskRootPath(path: string): boolean {
  if (platform() === 'win32') {
    return /^[a-zA-Z]:\\$/.test(path)
  } else {
    return path === '/'
  }
}

export async function checksumFromStream(s: Readable, alg: string) {
  const hash = createHash(alg)
  await pip(s, hash)
  return hash.digest('hex')
}

export function missing(file: string) {
  return access(file, constants.F_OK).then(() => false, () => true)
}
export function exists(file: string) {
  return access(file, constants.F_OK).then(() => true, () => false)
}
export function isDirectory(file: string) {
  return stat(file).then((s) => s.isDirectory(), () => false)
}
export function isFile(file: string) {
  return stat(file).then((s) => s.isFile(), () => false)
}
export async function readdirIfPresent(path: string): Promise<string[]> {
  if (!path) throw new TypeError('Path must not be undefined!')
  return readdir(path).catch((e) => {
    if (e.code === 'ENOENT') return []
    throw e
  })
}
export async function readdirEnsured(path: string) {
  if (!path) throw new TypeError('Path must not be undefined!')
  await ensureDir(path)
  return readdir(path)
}
export function validateSha256(path: string, sha256: string) {
  return checksum(path, 'sha256').then(s => s === sha256, () => false)
}

/**
 * This copy will not replace existed files.
 */
export async function copyPassively(src: string, dest: string, filter: (name: string) => boolean = () => true) {
  // Skip Windows reserved entries (pagefile.sys, System Volume Information, …).
  // These are kernel-locked and only ever reachable when src walks a drive
  // root — copying them is never the user's intent.
  if (isWindowsReservedName(src)) { return }
  const s = await stat(src).catch(() => { })
  if (!s) { return }
  if (!filter(src)) { return }
  if (s.isDirectory()) {
    await ensureDir(dest)
    const children = await readdir(src)
    await Promise.all(children.map((p) => copyPassively(resolve(src, p), resolve(dest, p))))
  } else if (await missing(dest)) {
    await copyFile(src, dest)
  }
}

/**
 * This link will not replace existed files.
 */
export async function linkPassively(src: string, dest: string, filter: (name: string) => boolean = () => true) {
  const s = await stat(src).catch(() => { })
  if (!s) { return }
  if (!filter(src)) { return }
  if (s.isDirectory()) {
    await ensureDir(dest)
    const children = await readdir(src)
    await Promise.all(children.map((p) => linkPassively(resolve(src, p), resolve(dest, p))))
  } else if (await missing(dest)) {
    await link(src, dest).catch((e) => {
      if (!isFileNoFound(e)) {
        throw e
      }
    })
  }
}

/**
 * Perform symbolic link from `srcPath` to `destPath`.
 *
 * Throws if neither `symlink('dir')` nor (on Windows) `symlink('junction')`
 * succeeds. The thrown error is annotated with `junction`, `srcExists` and
 * `destExists` so the runtime telemetry sink can categorise failures.
 *
 * Callers that need a non-symlink fallback (hardlink walk / byte copy)
 * should use {@link linkOrCopyDirectory} instead — but only when the
 * resulting semantics are acceptable for their use case (e.g. read-mostly
 * assets). Do *not* use the fallback for live, mutable data such as
 * Minecraft saves: per-file hardlinks and copies will silently diverge
 * from the source when the game writes new files (see #1428 / #1434).
 */
export async function linkDirectory(srcPath: string, destPath: string, logger: Logger) {
  try {
    await symlink(srcPath, destPath, 'dir')
    return true
  } catch (e) {
    if (((e as any).code === EPERM_ERROR || (e as any).code === 'EISDIR') && process.platform === 'win32') {
      await symlink(srcPath, destPath, 'junction').catch(e => {
        e.junction = true
        e.srcExists = existsSync(srcPath)
        e.destExists = existsSync(destPath)
        if (e.srcExists && e.destExists) {
          return true
        }
        throw e
      })
      return false
    }
    throw e
  }
}

/**
 * Like {@link linkDirectory} but falls back to a per-file hardlink walk and
 * finally to a byte copy when symlink + junction are both denied (typically
 * Windows users without admin / Developer Mode — issue #1428).
 *
 * **Only use this for read-mostly content** (e.g. mods, resourcepacks,
 * launcher-managed asset folders). The hardlink/copy fallbacks do not
 * propagate newly-created files from `srcPath` to `destPath`, so they are
 * unsafe for live, mutable data such as Minecraft worlds.
 *
 * On success the returned error annotations (`junction`,
 * `linkFallbackFailed`, `srcExists`, `destExists`) are stamped on the
 * thrown error so the runtime telemetry sink can distinguish genuine hard
 * failures from the EPERM noise the fallback neutralises.
 */
export async function linkOrCopyDirectory(srcPath: string, destPath: string, logger: Logger) {
  try {
    return await linkDirectory(srcPath, destPath, logger)
  } catch (e: any) {
    if (process.platform !== 'win32') throw e
    // Only fall back on the permission-denied family that the symlink path
    // would have raised. Anything else (ENOENT, EBUSY, ...) is a real bug
    // and should surface unchanged.
    if (!isSystemError(e) || (e.code !== EPERM_ERROR && e.code !== 'EISDIR')) {
      throw e
    }
    try {
      await linkPassively(srcPath, destPath)
      logger.warn(`linkOrCopyDirectory: symlink+junction failed for ${srcPath} -> ${destPath}; recovered via per-file hardlink`)
      return false
    } catch (e2: any) {
      if (isSystemError(e2) && (e2.code === 'EXDEV' || e2.code === 'EPERM')) {
        await copyPassively(srcPath, destPath)
        logger.warn(`linkOrCopyDirectory: symlink+junction+hardlink failed for ${srcPath} -> ${destPath}; recovered via copy`)
        return false
      }
      e2.junction = true
      e2.linkFallbackFailed = true
      e2.srcExists = existsSync(srcPath)
      e2.destExists = existsSync(destPath)
      throw e2
    }
  }
}

async function isSameFile(file1: string, file2: string) {
  if (file1 === file2) return true
  const stat1 = await stat(file1).catch(() => undefined)
  const stat2 = await stat(file2).catch(() => undefined)
  if (!stat1 || !stat2) return false
  if (stat1.ino === stat2.ino) return true
  if (stat1.size !== stat2.size) return false

  const fd1 = await open(file1, 'r')
  const fd2 = await open(file2, 'r')

  const bufferSize = 262144
  const buffer = Buffer.alloc(bufferSize)

  let offset = 0
  let currentRead = 0

  try {
    do {
      const { bytesRead: read1 } = await read(fd1, buffer, 0, 131072, offset)
      const { bytesRead: read2 } = await read(fd2, buffer, 131072, 131072, offset)
      if (read1 !== read2) return false

      const srcPart = buffer.subarray(0, read1)

      if (!srcPart.equals(buffer.subarray(131072, read2))) return false
      offset += read1
      currentRead = read1
    } while (currentRead === bufferSize)
  } finally {
    await close(fd1)
    await close(fd2)
  }
}


/**
 * Perform hard link or copy file from `from` to `to`.
 */
export function linkOrCopyFile(from: string, to: string) {
  const onLinkFileError = async (e: unknown, copied: boolean) => {
    if (isSystemError(e) && e.code === 'EEXIST') {
      const sameFile = await isSameFile(from, to)
      if (sameFile) {
        return to
      }
      throw e
    }
    if (copied) {
      throw e
    } else {
      await copyFile(from, to).catch(e => onLinkFileError(e, true))
    }
    return to
  }

  return link(from, to).then(() => to).catch((e) => onLinkFileError(e, false))
}

function linkWithTimeout(from: string, to: string, timeout = 1500) {
  return new Promise<void>((resolve, reject) => {
    link(from, to).then(resolve, reject)
    setTimeout(() => reject(new AnyError('TimeoutError')), timeout)
  })
}

export function isInSameDisk(from: string, to: string, os: 'osx' | 'linux' | 'windows' | 'unknown') {
  if (os === 'linux') {
    return from.startsWith(to) || to.startsWith(from)
  } else if (os === 'windows') {
    return from[0] === to[0]
  } else {
    return from.startsWith(to) || to.startsWith(from)
  }
}

export async function linkWithTimeoutOrCopy(from: string, to: string, timeout = 1500) {
  try {
    await linkWithTimeout(from, to, timeout)
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || (isSystemError(e) && e.code === 'EXDEV'))) {
      await copyFile(from, to)
    }
    return e
  }
}

/**
 * No such file or directory: Commonly raised by fs operations to indicate that a component
 * of the specified pathname does not exist. No entity (file or directory) could be found
 * by the given path
 */
export const ENOENT_ERROR = 'ENOENT'

/**
 * Operation not permitted. An attempt was made to perform an operation that requires
 * elevated privileges.
 */
export const EPERM_ERROR = 'EPERM'

export function handleOnlyNotFound(e: unknown) {
  if (isSystemError(e) && e.code === ENOENT_ERROR) {
    return undefined
  }
  throw e
}

export async function isHardLinked(from: string, to: string) {
  const rootStat = await stat(from).catch(handleOnlyNotFound)
  const instanceStat = await stat(to).catch(handleOnlyNotFound)

  return !!rootStat && !!instanceStat && rootStat.ino === instanceStat.ino
}

export async function hardLinkFiles(root: string, to: string) {
  const rootStat = await stat(root).catch(handleOnlyNotFound)
  const instanceStat = await stat(to).catch(handleOnlyNotFound)

  if (!rootStat && instanceStat) {
    // no root, copy current to root
    return await linkOrCopyFile(to, root)
  }

  if (!instanceStat) {
    await ensureFile(root)
    // no instance, copy root to instance
    return await linkOrCopyFile(root, to)
  }

  if (rootStat?.ino !== instanceStat.ino) {
    // different, copy root to instance
    await unlink(to).catch(handleOnlyNotFound)
    return await linkOrCopyFile(root, to)
  }

  return to
}

export async function unHardLinkFiles(root: string, inst: string) {
  const rootStat = await stat(root).catch(handleOnlyNotFound)
  const instanceStat = await stat(inst).catch(handleOnlyNotFound)

  if (rootStat?.ino === instanceStat?.ino) {
    await unlink(inst).catch(handleOnlyNotFound)
    await copyFile(root, inst)
  }
}
