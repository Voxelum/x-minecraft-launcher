export abstract class FileSystem {
  abstract readonly root: string
  abstract readonly sep: string
  abstract readonly type: 'zip' | 'path'
  abstract readonly writeable: boolean

  // base methods

  abstract join(...paths: string[]): string

  abstract isDirectory(name: string): Promise<boolean>
  abstract existsFile(name: string): Promise<boolean>
  abstract readFile(name: string, encoding: 'utf-8' | 'base64'): Promise<string>
  abstract readFile(name: string, encoding: undefined): Promise<Uint8Array>
  abstract readFile(name: string): Promise<Uint8Array>
  abstract readFile(name: string, encoding?: 'utf-8' | 'base64'): Promise<Uint8Array | string>

  /**
   * Get the url for a file entry. If the system does not support get url. This should return an empty string.
   */
  getUrl(name: string): string {
    return ''
  }

  abstract listFiles(name: string): Promise<string[]>

  abstract cd(name: string): void

  isClosed(): boolean {
    return false
  }
  close(): void {}

  // extension methods

  async missingFile(name: string) {
    return this.existsFile(name).then((v) => !v)
  }

  async walkFiles(target: string, walker: (path: string) => void | Promise<void>) {
    if (await this.isDirectory(target)) {
      const childs = await this.listFiles(target)
      for (const child of childs) {
        await this.walkFiles(this.join(target, child), walker)
      }
    } else {
      const result = walker(this.join(target))
      if (result instanceof Promise) {
        await result
      }
    }
  }
}
