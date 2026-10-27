import { open, readAllEntries } from '@xmcl/unzip'
import { stat } from 'fs-extra'
import { ZipFile, Entry } from '@xmcl/yauzl'

/**
 * The managed zip.
 */
export interface ManagedZipFile {
  file: ZipFile
  entries: Record<string, Entry>
  /**
   * Dispose the zip file.
   */
  dispose(): void
}

export class ZipManager {
  #files = new Map<string, Promise<ManagedZipFile>>()

  async close() {
    for (const file of new Set(this.#files.values())) {
      const f = await file
      f.file.close()
    }
  }

  /**
   * 让某个 zip 的缓存失效。
   *
   * 原地替换 zip 文件后必须调用，否则后续读取仍会命中旧句柄，读到替换前的内容。
   * 这里只关闭句柄并丢弃路径缓存，不会等待可能正在进行的扫描。
   */
  invalidate(filePath: string) {
    const pathKey = `path:${filePath}`
    const cached = this.#files.get(pathKey)
    this.#files.delete(pathKey)
    if (cached) {
      cached.then(f => f.file.close()).catch(() => undefined)
    }
  }

  /**
   * Open or get a managed zip file.
   * @param filePath The file path.
   * @returns The managed zip file.
   */
  async open(filePath: string): Promise<ManagedZipFile> {
    const pathKey = `path:${filePath}`
    const cachedByPath = this.#files.get(pathKey)
    if (cachedByPath) return cachedByPath

    const fStat = await stat(filePath)
    const inodeKey = `inode:${fStat.ino}`

    const cachedByInode = this.#files.get(inodeKey)
    if (cachedByInode) {
      // The same archive can be reached via a renamed path, hard link, or
      // modpack cache alias. Reuse the inode cache rather than returning the
      // (unset) path key, which left callers with `undefined` and caused
      // openModpack to throw when reading `zip.entries`.
      return cachedByInode
    }

    const promise = open(filePath).then(async (zip) => {
      const dispose = () => {
        if (zip.isOpen) {
          zip.close()
        }
        this.#files.delete(pathKey)
        this.#files.delete(inodeKey)
      }
      zip.once('close', dispose)

      Object.assign(zip, { fileName: filePath })

      const file: ManagedZipFile = {
        file: zip,
        entries: Object.fromEntries((await readAllEntries(zip)).map(e => [e.fileName, e])),
        dispose,
      }
      return file
    })

    this.#files.set(pathKey, promise)
    this.#files.set(inodeKey, promise)

    return promise
  }
}
