import { stat } from 'fs-extra'
import { dirname, join } from 'path'
import { Client, SFTPWrapper, Stats } from 'ssh2'
import { LauncherApp } from '../app/LauncherApp'
import { InstanceExporter } from './instanceExportServer'

export class SSHInstanceExporter extends InstanceExporter {
  constructor(app: LauncherApp, dataRoot: string, private remoteFolder: string, private ssh: Client, private sftp: SFTPWrapper) {
    super(app, dataRoot)
  }

  #filesProgress: Record<string, { total: number; progress: number }> = {}

  #update(chunk: number) {
    let _total = 0
    let _progress = 0
    for (const { total, progress } of Object.values(this.#filesProgress)) {
      _total += total
      _progress += progress
    }
    this.onProgress(chunk, _progress, _total)
  }

  abort() {
    this.sftp.end()
  }

  async stat(path: string): Promise<Stats> {
    return new Promise<Stats>((resolve, reject) => {
      this.sftp.stat(path, (e, stat) => {
        if (e) {
          reject(e)
        } else {
          resolve(stat)
        }
      })
    })
  }

  async ensureDir(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.ssh.exec(`mkdir -p ${path}`, (e) => {
        if (e) {
          reject(e)
        } else {
          resolve()
        }
      })
    })
  }

  async fastPut(localPath: string, remotePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.sftp.fastPut(localPath, remotePath, {
        step: (total, nb, fsize) => {
          this.#filesProgress[localPath].progress = total
          this.#update(nb)
        },
      }, (e) => {
        if (e) {
          if (e.message === 'No such file') {
            e.message = `fPut: No such file or directory: ${localPath} -> ${remotePath}`
          }
          reject(e)
        } else {
          resolve()
        }
      })
    })
  }

  async copyFile(from: string, to: string): Promise<void> {
    const targetPath = join(this.remoteFolder, to).replaceAll('\\', '/')

    const currentStat = await this.stat(targetPath).catch(() => undefined)
    const localStat = await stat(from)
    if (currentStat && currentStat.size === localStat.size) {
      return
    }
    await this.ensureDir(dirname(targetPath)).catch(() => undefined)
    this.#filesProgress[from] = ({ total: localStat.size, progress: 0 })
    this.#update(0)
    return await this.fastPut(from, targetPath)
  }

  async emitFile(path: string, content: string): Promise<void> {
    path = join(this.remoteFolder, path).replaceAll('\\', '/')

    const currentStat = await this.stat(path).catch(() => undefined)
    if (currentStat && currentStat.size === content.length) {
      return
    }
    await this.ensureDir(dirname(path)).catch(() => undefined)
    await new Promise<void>((resolve, reject) => {
      this.sftp.writeFile(path, content, (e) => {
        if (e) {
          reject(e)
        } else {
          resolve()
        }
      })
    })
  }
}
