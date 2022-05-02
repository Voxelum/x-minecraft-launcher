import { checksum } from '@xmcl/core'
import { readFile, writeFile } from 'fs-extra'
import { Worker } from 'worker_threads'
import { Manager } from '.'
import { LauncherApp } from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { WorkerInterface, WorkerResponse } from '../entities/worker'
import createWorker, { path } from '../workers/index?worker'

export default class WorkerManager extends Manager {
  private worker: WorkerInterface
  private threadWorker: Worker | undefined
  private counter = 0
  private destroyTimer: undefined | ReturnType<typeof setTimeout>

  constructor(app: LauncherApp) {
    super(app)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _ = this
    this.worker = new Proxy({} as any, {
      get(__, method) {
        return (...args: any[]) => {
          const _id = _.counter++
          return new Promise((resolve, reject) => {
            if (!_.threadWorker) {
              _.threadWorker = createWorker()
              _.threadWorker.once('message', (m) => {
                if (m === 'idle') {
                  if (_.destroyTimer) {
                    clearTimeout(_.destroyTimer)
                  }
                  _.destroyTimer = setTimeout(() => {
                    _.threadWorker = undefined
                    _.destroyTimer = undefined
                  }, 1000 * 3)
                }
              })
            }

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
      const workerJsPath = path.replace('.unpacked', '')
      const asarWorkerJsPath = path
      const realSha = await checksum(workerJsPath, 'sha1')
      const expectSha = await checksum(asarWorkerJsPath, 'sha1')
      if (realSha !== expectSha) {
        this.log('The worker js checksum not matched. Replace with the asar worker js.')
        await writeFile(workerJsPath, await readFile(asarWorkerJsPath))
      } else {
        this.log('The worker js checksum matched. Skip to replace asar worker js.')
      }
    }
  }

  getWorker(): WorkerInterface {
    return this.worker
  }
}
