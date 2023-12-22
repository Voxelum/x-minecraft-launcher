import { randomBytes } from 'crypto'
import { mkdir, readdir, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { isSystemError } from '../util/error'
import { Platform } from '@xmcl/runtime-api'

export async function validateDirectory(platform: Platform, path: string) {
  // Check if the path is the root of the drive
  if ((platform.os === 'osx' || platform.os === 'linux') && path === '/') {
    return 'bad'
  }
  if (platform.os === 'windows' && (/^[a-zA-Z]:\\$/.test(path))) {
    return 'bad'
  }

  const fStat = await stat(path).catch(() => undefined)
  if (fStat) {
    if (!fStat.isDirectory()) {
      return 'nondictionary'
    }
    // Check if we can write under the directory
    try {
      const tempFileName = '.' + randomBytes(16).toString('hex')
      await writeFile(join(path, tempFileName), '.')
      await unlink(join(path, tempFileName))
    } catch (e) {
      if (isSystemError(e)) {
        if (e.code === 'EACCES') {
          return 'noperm'
        }
      }
      return 'bad'
    }
    // Check if the directory is empty
    const files = await readdir(path)
    return files.length > 0 ? 'exists' : undefined
  } else {
    // Check if we have permission to create the directory
    try {
      await mkdir(path, { recursive: true })
      await unlink(path)
    } catch (e) {
      if (isSystemError(e)) {
        if (e.code === 'EACCES') {
          return 'noperm'
        }
      }
      return 'bad'
    }
  }
  return undefined
}
