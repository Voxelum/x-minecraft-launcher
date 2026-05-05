import { FileSystem } from './system'
import JSZip from 'jszip'

class JSZipFS extends FileSystem {
  sep = '/'
  type: 'zip' | 'path' = 'zip'
  writeable = true
  root = ''

  protected normalizePath(path: string): string {
    if (path.startsWith('/')) {
      path = path.substring(1)
    }
    if (this.root !== '') {
      path = [this.root, path].join('/')
    }
    return path
  }

  join(...paths: string[]): string {
    return paths.join('/')
  }

  isDirectory(name: string): Promise<boolean> {
    name = this.normalizePath(name)
    name = name.endsWith('/') ? name : name + '/'
    return Promise.resolve(Object.keys(this.zip.files).some((e) => e.startsWith(name)))
  }

  async writeFile(name: string, data: Uint8Array): Promise<void> {
    name = this.normalizePath(name)
    this.zip.file(name, data)
  }

  existsFile(name: string): Promise<boolean> {
    name = this.normalizePath(name)
    if (this.zip.files[name] !== undefined) {
      return Promise.resolve(true)
    }
    return this.isDirectory(name)
  }

  readFile(name: any, encoding?: any): Promise<any> {
    name = this.normalizePath(name)
    if (!encoding) {
      return this.zip.files[name].async('uint8array')
    }
    if (encoding === 'utf-8') {
      return this.zip.files[name].async('text')
    }
    if (encoding === 'base64') {
      return this.zip.files[name].async('base64')
    }
    throw new TypeError(`Expect encoding to be utf-8/base64 or empty. Got ${encoding}.`)
  }

  async listFiles(name: string): Promise<string[]> {
    if (!(await this.isDirectory(name))) {
      return Promise.reject(new TypeError('Require a directory!'))
    }
    name = this.normalizePath(name)
    return Promise.resolve(
      Object.keys(this.zip.files)
        .filter((e) => e.startsWith(name))
        .map((e) => e.substring(name.length))
        .map((e) => (e.startsWith('/') ? e.substring(1) : e))
        .map((e) => e.split('/')[0]),
    )
  }

  cd(name: string): void {
    if (name.startsWith('/')) {
      this.root = name.substring(1)
      return
    }
    const paths = name.split('/')
    for (const path of paths) {
      if (path === '.') {
        continue
      } else if (path === '..') {
        const sub = this.root.split('/')
        if (sub.length > 0) {
          sub.pop()
          this.root = sub.join('/')
        }
      } else {
        if (this.root === '') {
          this.root = path
        } else {
          this.root += `/${path}`
        }
      }
    }
  }

  constructor(private zip: JSZip) {
    super()
  }
}

export async function openFileSystem(basePath: string | Uint8Array): Promise<FileSystem> {
  if (typeof basePath === 'string') {
    throw new Error('Unsupported')
  }
  return new JSZipFS(await JSZip.loadAsync(basePath))
}
export function resolveFileSystem(base: string | Uint8Array | FileSystem): Promise<FileSystem> {
  if (typeof base === 'string' || base instanceof Uint8Array) {
    return openFileSystem(base)
  } else {
    return Promise.resolve(base)
  }
}

export * from './system'
