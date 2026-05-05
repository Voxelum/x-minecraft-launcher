/**
 * @module @xmcl/system
 */
import { open, readEntry, readAllEntries } from '@xmcl/unzip'
import {
  access as saccess,
  stat as sstat,
  writeFile as swriteFile,
  readFile as sreadFile,
  readdir as sreaddir,
} from 'fs'
import { promisify } from 'util'
import { join, sep } from 'path'
import { FileSystem } from './system'
import { ZipFile, Entry } from 'yauzl'

const access = promisify(saccess)
const stat = promisify(sstat)
const writeFile = promisify(swriteFile)
const readFile = promisify(sreadFile)
const readdir = promisify(sreaddir)

export async function openFileSystem(basePath: string | Uint8Array): Promise<FileSystem> {
  if (typeof basePath === 'string') {
    const fstat = await stat(basePath)
    if (fstat.isDirectory()) {
      return new NodeFileSystem(basePath)
    } else {
      const zip = await open(basePath)
      Object.assign(zip, {
        validateFileName: (e: Entry) => {
          const fileName = e.fileName
          if (/^[a-zA-Z]:/.test(fileName) || fileName.startsWith('/')) {
            // absolute path convert to relative path
            e.fileName = fileName.replace(/^[a-zA-Z]:/, '').replace(/^\//, '')
          }
          return null
        },
      })
      const entries = await readAllEntries(zip).then((es) =>
        // ignore entries with '..' in the path
        es.filter((e) => e.fileName.split('/').indexOf('..') === -1),
      )
      const entriesRecord: Record<string, Entry> = {}
      for (const entry of entries) {
        entriesRecord[entry.fileName] = entry
      }
      return new NodeZipFileSystem(basePath, zip, entriesRecord)
    }
  } else {
    const zip = await open(basePath as unknown as Buffer)
    const entries = await readAllEntries(zip)
    const entriesRecord: Record<string, Entry> = {}
    for (const entry of entries) {
      entriesRecord[entry.fileName] = entry
    }
    return new NodeZipFileSystem('', zip, entriesRecord)
  }
}
export function resolveFileSystem(base: string | Uint8Array | FileSystem): Promise<FileSystem> {
  if (typeof base === 'string' || base instanceof Uint8Array || Buffer.isBuffer(base)) {
    return openFileSystem(base as string | Uint8Array)
  } else {
    return Promise.resolve(base)
  }
}

class NodeFileSystem extends FileSystem {
  sep = sep
  type = 'path' as const
  writeable = true
  join(...paths: string[]): string {
    return join(...paths)
  }

  getUrl(name: string) {
    return `file://${this.join(this.root, name)}`
  }

  isDirectory(name: string): Promise<boolean> {
    return stat(join(this.root, name)).then((s) => s.isDirectory())
  }

  writeFile(name: string, data: Uint8Array): Promise<void> {
    return writeFile(join(this.root, name), data)
  }

  existsFile(name: string): Promise<boolean> {
    return access(join(this.root, name)).then(
      () => true,
      () => false,
    )
  }

  readFile(name: any, encoding?: any) {
    return readFile(join(this.root, name), { encoding }) as any
  }

  listFiles(name: string): Promise<string[]> {
    return readdir(join(this.root, name))
  }

  cd(name: string): void {
    this.root = join(this.root, name)
  }

  constructor(public root: string) {
    super()
  }
}
class NodeZipFileSystem extends FileSystem {
  sep = '/'
  type = 'zip' as const
  writeable = false

  private zipRoot = ''

  private fileRoot: string

  constructor(
    root: string,
    private zip: ZipFile,
    private entries: Record<string, Entry>,
  ) {
    super()
    this.fileRoot = root
  }

  isClosed(): boolean {
    return !this.zip.isOpen
  }

  close(): void {
    this.zip.close()
  }

  get root() {
    return this.fileRoot + (this.zipRoot.length === 0 ? '' : `/${this.zipRoot}`)
  }

  protected normalizePath(name: string): string {
    if (name.startsWith('/')) {
      name = name.substring(1)
    }
    if (this.zipRoot !== '') {
      name = [this.zipRoot, name].join('/')
    }
    return name
  }

  join(...paths: string[]): string {
    return paths.join('/')
  }

  isDirectory(name: string): Promise<boolean> {
    name = this.normalizePath(name)
    if (name === '') {
      return Promise.resolve(true)
    }
    if (this.entries[name]) {
      return Promise.resolve(name.endsWith('/'))
    }
    if (this.entries[name + '/']) {
      return Promise.resolve(true)
    }
    // the root dir won't have entries
    // therefore we need to do an extra track here
    const entries = Object.keys(this.entries)
    return Promise.resolve(entries.some((e) => e.startsWith(name + '/')))
  }

  existsFile(name: string): Promise<boolean> {
    name = this.normalizePath(name)
    if (this.entries[name] || this.entries[name + '/']) {
      return Promise.resolve(true)
    }
    // the root dir won't have entries
    // therefore we need to do an extra track here
    const entries = Object.keys(this.entries)
    return Promise.resolve(entries.some((e) => e.startsWith(name + '/')))
  }

  async readFile(name: string, encoding?: 'utf-8' | 'base64'): Promise<any> {
    name = this.normalizePath(name)
    const entry = this.entries[name]
    if (!entry) {
      throw new Error(`Not found file named ${name}`)
    }
    const buffer = await readEntry(this.zip, entry)
    if (encoding === 'utf-8') {
      return buffer.toString('utf-8')
    }
    if (encoding === 'base64') {
      return buffer.toString('base64')
    }
    return buffer
  }

  listFiles(name: string): Promise<string[]> {
    name = this.normalizePath(name)
    return Promise.resolve([
      ...new Set(
        Object.keys(this.entries)
          .filter((n) => n.startsWith(name))
          .map((n) => n.substring(name.length))
          .map((n) => (n.startsWith('/') ? n.substring(1) : n))
          .map((n) => n.split('/')[0]),
      ),
    ])
  }

  cd(name: string): void {
    if (name.startsWith('/')) {
      this.zipRoot = name.substring(1)
      return
    }
    const paths = name.split('/')
    for (const path of paths) {
      if (path === '.') {
        continue
      } else if (path === '..') {
        const sub = this.zipRoot.split('/')
        if (sub.length > 0) {
          sub.pop()
          this.zipRoot = sub.join('/')
        }
      } else {
        if (this.zipRoot === '') {
          this.zipRoot = path
        } else {
          this.zipRoot += `/${path}`
        }
      }
    }
  }

  async walkFiles(startingDir: string, walker: (path: string) => void | Promise<void>) {
    startingDir = this.normalizePath(startingDir)
    const root = startingDir.startsWith('/') ? startingDir.substring(1) : startingDir
    for (const child of Object.keys(this.entries).filter((e) => e.startsWith(root))) {
      if (child.endsWith('/')) {
        continue
      }
      const result = walker(child)
      if (result instanceof Promise) {
        await result
      }
    }
  }
}

export * from './system'
