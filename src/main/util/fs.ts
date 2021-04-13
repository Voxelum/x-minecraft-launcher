import { checksum } from '@xmcl/core'
import { createHash } from 'crypto'
import { fromFile } from 'file-type'
import { FileExtension } from 'file-type/core'
import filenamify from 'filenamify'
import { access, constants, copy, copyFile, ensureDir, FSWatcher, link, readdir, stat, unlink, watch } from 'fs-extra'
import { extname, join, resolve } from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'

const pip = promisify(pipeline)

export { pip as pipeline }
export { checksum }

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
  if (!path) throw new Error('Path must not be undefined!')
  return readdir(path).catch((e) => {
    if (e.code === 'ENOENT') return []
    throw e
  })
}
export async function readdirEnsured(path: string) {
  if (!path) throw new Error('Path must not be undefined!')
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
  const s = await stat(src).catch(() => { })
  if (!s) { return }
  if (!filter(src)) { return }
  if (s.isDirectory()) {
    await ensureDir(dest)
    const childs = await readdir(src)
    await Promise.all(childs.map((p) => copyPassively(resolve(src, p), resolve(dest, p))))
  } else if (await missing(dest)) {
    await copyFile(src, dest)
  }
}
export async function clearDirectoryNarrow(dir: string) {
  const files = await readdir(dir)
  await Promise.all(files.map(async (f) => {
    const file = join(dir, f)
    if (await exists(file) && !(await isDirectory(file))) {
      await unlink(join(dir, f))
    }
  }))
}

export class FileStateWatcher<T> {
  private watcher: FSWatcher | undefined

  private state: T

  private watching: string | undefined

  // eslint-disable-next-line no-useless-constructor
  constructor(private defaultState: T, private handler: (state: T, event: string, file: string) => T) {
    this.state = defaultState
  }

  public watch(file: string) {
    if (this.watching === file) return false
    if (this.watcher) { this.watcher.close() }
    this.watcher = watch(file, (event, file) => {
      this.state = this.handler(this.state, event, file)
    })
    return true
  }

  public getStateAndReset() {
    const state = this.state
    this.state = this.defaultState
    return state
  }

  close() {
    this.watcher?.close()
  }
}

export function getSuggestedFilename(name: string) {
  name = filenamify(name)
  name = name.replace('§', '')
  return name
}

export function sha1(data: Buffer) {
  return createHash('sha1').update(data).digest('hex')
}

export function sha1ByPath(path: string) {
  return checksum(path, 'sha1')
}

export function swapExt(path: string, ext: string) {
  const existedExt = extname(path)
  return path.substring(0, path.length - existedExt.length) + ext
}

export function linkOrCopy(from: string, to: string) {
  return link(from, to).catch(() => copy(from, to))
}

export function linkWithTimeout(from: string, to: string, timeout = 1500) {
  return new Promise<void>((resolve, reject) => {
    link(from, to).then(resolve, reject)
    setTimeout(() => reject(new Error('timeout')), timeout)
  })
}

export function linkWithTimeoutOrCopy(from: string, to: string, timeout = 1500) {
  return linkWithTimeout(from, to, timeout).catch(() => copy(from, to))
}

export type FileType = FileExtension | 'unknown' | 'directory'

export async function fileType(path: string): Promise<FileType> {
  const result = await fromFile(path)
  return result?.ext ?? 'unknown'
}

/**
 * An existing file was the target of an operation that required that the target not exist
 */
export const EEXIST_ERROR = 'EEXIST'

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
