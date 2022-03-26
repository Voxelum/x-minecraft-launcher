import { checksum } from '@xmcl/core'
import { readFile, writeFile } from 'fs-extra'
import { dirname, join } from 'path'
import { Worker } from 'worker_threads'
import { Manager } from '.'
import { LauncherApp } from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { WorkerInterface, WorkerResponse } from '../entities/worker'
import createWorker from '../workers/index?worker'

export default class WorkerManager extends Manager {
  private worker: WorkerInterface
  private threadWorker: Worker | undefined
  private counter = 0

  constructor(app: LauncherApp) {
    super(app)
    this.threadWorker = createWorker()
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _ = this
    this.worker = new Proxy({} as any, {
      get(__, method) {
        return (...args: any[]) => {
          const _id = _.counter++
          return new Promise((resolve, reject) => {
            const handler = (resp: WorkerResponse) => {
              const { error, result, id } = resp
              if (id === _id) {
                _.threadWorker?.removeListener('message', handler)
                if (error) {
                  reject(error)
                } else {
                  resolve(result)
                }
              }
            }
            _.threadWorker?.on('message', handler)
            _.threadWorker?.postMessage({ type: method, id: _id, args })
          })
        }
      },
    })
  }

  async setup() {
    if (!IS_DEV) {
      const exe = this.app.getPath('exe')
      const appPath = dirname(exe)
      const workerJsPath = join(appPath, 'resources', 'app.asar.unpacked', 'dist', 'index.worker.js')
      const asarWorkerJsPath = join(appPath, 'resources', 'app.asar', 'dist', 'index.worker.js')
      const realSha = await checksum(workerJsPath, 'sha1')
      const expectSha = await checksum(asarWorkerJsPath, 'sha1')
      if (realSha !== expectSha) {
        this.log('The worker js checksum not matched. Replace with the asar worker js.')
        await writeFile(workerJsPath, await readFile(asarWorkerJsPath))
        this.threadWorker?.terminate()
        this.threadWorker = createWorker()
      } else {
        this.log('The worker js checksum matched. Skip to replace asar worker js.')
      }
    }
  }

  getWorker(): WorkerInterface {
    return this.worker
  }
}
