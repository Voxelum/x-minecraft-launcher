import { Platform } from '@xmcl/runtime-api'
import { randomBytes } from 'crypto'
import { existsSync, mkdir, readdir, rmdir, stat, unlink, writeFile } from 'fs-extra'
import { dirname, join, resolve } from 'path'
import { isSystemError } from '../util/error'

async function isExistedXMCLDir(path: string) {
  const versions = join(path, 'versions')
  const versionsExisted = existsSync(versions)
  const libraries = join(path, 'libraries')
  const librariesExisted = existsSync(libraries)
  const instances = join(path, 'instances')
  const instancesExisted = existsSync(instances)

  if (versionsExisted && librariesExisted && instancesExisted) {
    return true
  }
  return false
}

export function isValidPathName(pathName: string) {
  const allowedChars = /^[a-zA-Z0-9\-_\.\s\/\\:\(\)\,\[\]\{\}'"!@#\$%\^&\+=;~`]+$/
  if (!allowedChars.test(pathName)) {
    return false
  }
  return true
}

export async function validateDirectory(platform: Platform, path: string, skipCharCheck = false) {
  path = resolve(path)

  // Check if the path is the root of the drive
  if ((platform.os === 'osx' || platform.os === 'linux') && path === '/') {
    return 'bad'
  }

  if (!skipCharCheck && !isValidPathName(path)) {
    return 'invalidchar'
  }

  if (platform.os === 'windows') {
    if ((/^[a-zA-Z]:\\$/.test(path))) {
      return 'bad'
    }
    const sysRoot = process.env.SystemRoot
    // should not under system root
    if (sysRoot && path.startsWith(sysRoot)) {
      return 'bad'
    }
  }

  // path should not under exe dir
  const exePath = process.execPath
  if (exePath && path.startsWith(dirname(exePath))) {
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
    if (await isExistedXMCLDir(path)) {
      return undefined
    }
    const files = await readdir(path)
    return files.length > 0 ? 'exists' : undefined
  } else {
    // Check if we have permission to create the directory
    try {
      await mkdir(path, { recursive: true })
      await rmdir(path)
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
