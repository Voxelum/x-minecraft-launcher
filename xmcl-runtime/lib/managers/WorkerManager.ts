import { Manager } from '.'
import { LauncherApp } from '../app/LauncherApp'
import { WorkerInterface, WorkerResponse } from '../entities/worker'
import createWorker from '../workers/index?worker'

export default class WorkerManager extends Manager {
  private worker: WorkerInterface

  constructor(app: LauncherApp) {
    super(app)
    let counter = 0
    const threadWorker = createWorker()
    this.worker = new Proxy({} as any, {
      get(_, method) {
        return (...args: any[]) => {
          const _id = counter++
          return new Promise((resolve, reject) => {
            const handler = (resp: WorkerResponse) => {
              const { error, result, id } = resp
              if (id === _id) {
                threadWorker.removeListener('message', handler)
                if (error) {
                  reject(error)
                } else {
                  resolve(result)
                }
              }
            }
            threadWorker.on('message', handler)
            threadWorker.postMessage({ type: method, id: _id, args })
          })
        }
      },
    })
  }

  getWorker(): WorkerInterface {
    return this.worker
  }
}
