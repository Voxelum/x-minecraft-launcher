import { isNotNull } from '@xmcl/core/utils'
import { stat } from 'fs-extra'
import { dirname, join } from 'path'
import type { Client, SFTPWrapper, Stats } from 'ssh2'
import { ServerExporter } from './server_exporter'

export class ServerSSHExporter extends ServerExporter {
  constructor(
    dataRoot: string,
    private remoteFolder: string,
    private ssh: Client,
    private sftp: SFTPWrapper,
  ) {
    super(dataRoot)
  }

  #filesProgress: Record<string, { total: number; progress: number }> = {}
  #tasks: Array<{ from: string; to: string } | { to: string; content: string }> = []

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

  async fastPut(localPath: string, remotePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (total, nb, fsize) => {
            this.#filesProgress[localPath].progress = total
            this.#update(nb)
          },
        },
        (e) => {
          if (e) {
            if (e.message === 'No such file') {
              e.message = `fPut: No such file or directory: ${localPath} -> ${remotePath}`
            }
            reject(e)
          } else {
            resolve()
          }
        },
      )
    })
  }

  copyFile(from: string, to: string) {
    const targetPath = join(this.remoteFolder, to).replaceAll('\\', '/')
    this.#tasks.push({ from, to: targetPath })
  }

  emitFile(path: string, content: string): void {
    path = join(this.remoteFolder, path).replaceAll('\\', '/')
    this.#tasks.push({ to: path, content })
  }

  async end(): Promise<void> {
    const remaining = await Promise.all(
      this.#tasks.map(async ({ to, ...rest }) => {
        const currentStat = await this.stat(to).catch(() => undefined)
        const localSize =
          'from' in rest
            ? await stat(rest.from).then(
                (s) => s.size,
                () => 0,
              )
            : rest.content.length
        if (currentStat && currentStat.size === localSize) {
          return
        }
        return { to, ...rest }
      }),
    ).then((tasks) => tasks.filter(isNotNull))

    await new Promise<void>((resolve, reject) => {
      const dirs = remaining.map(({ to }) => dirname(to))
      const dirsString = dirs.map((d) => '"' + d + '"').join(' ')
      this.ssh.exec(`mkdir -p ${dirsString}`, (e) => {
        if (e) {
          reject(e)
        } else {
          resolve()
        }
      })
    })

    await Promise.all(
      remaining.map(async ({ to, ...rest }) => {
        if ('from' in rest) {
          this.#filesProgress[rest.from] = {
            total: await stat(rest.from).then(
              (s) => s.size,
              () => 0,
            ),
            progress: 0,
          }
          this.#update(0)
          return await this.fastPut(rest.from, to)
        }

        return await new Promise<void>((resolve, reject) => {
          this.sftp.writeFile(to, rest.content, (e) => {
            if (e) {
              reject(e)
            } else {
              resolve()
            }
          })
        })
      }),
    )
  }
}
