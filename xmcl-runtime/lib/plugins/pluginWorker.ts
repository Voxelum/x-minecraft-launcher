import { readFile, writeFile } from 'fs/promises'
import { Worker } from 'worker_threads'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { kWorker, WorkerInterface, WorkerResponse } from '../entities/worker'
import { checksum } from '../util/fs'
import createWorker, { path } from '../workers/index?worker'

export const pluginWorker: LauncherAppPlugin = async (app) => {
  let threadWorker: Worker | undefined
  let counter = 0
  let destroyTimer: undefined | ReturnType<typeof setTimeout>

  const worker: WorkerInterface = new Proxy({} as any, {
    get(_, method) {
      return (...args: any[]) => {
        const _id = counter++
        return new Promise((resolve, reject) => {
          if (!threadWorker) {
            threadWorker = createWorker()
            threadWorker.once('message', (m) => {
              if (m === 'idle') {
                if (destroyTimer) {
                  clearTimeout(destroyTimer)
                }
                destroyTimer = setTimeout(() => {
                  threadWorker = undefined
                  destroyTimer = undefined
                }, 1000 * 3)
              }
            })
          }

          const handler = (resp: WorkerResponse) => {
            const { error, result, id } = resp
            if (id === _id) {
              threadWorker?.removeListener('message', handler)
              if (error) {
                reject(error)
              } else {
                resolve(result)
              }
            }
          }
          threadWorker?.on('message', handler)
          threadWorker?.postMessage({ type: method, id: _id, args })
        })
      }
    },
  })
  app.registry.register(kWorker, worker)

  app.waitEngineReady().then(async () => {
    const logger = app.logManager.getLogger('WorkerManager')
    if (!IS_DEV) {
      const workerJsPath = path.replace('.unpacked', '')
      const asarWorkerJsPath = path
      const realSha = await checksum(workerJsPath, 'sha1')
      const expectSha = await checksum(asarWorkerJsPath, 'sha1')
      if (realSha !== expectSha) {
        logger.log('The worker js checksum not matched. Replace with the asar worker js.')
        await writeFile(workerJsPath, await readFile(asarWorkerJsPath))
      } else {
        logger.log('The worker js checksum matched. Skip to replace asar worker js.')
      }
    }
  })
}
