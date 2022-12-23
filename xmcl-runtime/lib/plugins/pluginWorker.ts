import { readFile, writeFile } from 'fs/promises'
import { Worker } from 'worker_threads'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { EncodingWorker, kEncodingWorker } from '../entities/encodingWorker'
import { kResourceWorker, ResourceWorker, WorkerResponse } from '../entities/resourceWorker'
import { checksum } from '../util/fs'
import createResourceWorker, { path as resourceWorkerPath } from '../workers/resourceWorkerEntry?worker'
import createEncodingWorker, { path as encodingWorkerPath } from '../workers/encodingWorkerEntry?worker'

export const pluginWorker: LauncherAppPlugin = async (app) => {
  const logger = app.logManager.getLogger('WorkerManager')
  const checkUpdate = async (path: string) => {
    if (!IS_DEV) {
      logger.log('Try to update worker js as this is PROD')
      const workerJsPath = path.replace('.unpacked', '')
      const asarWorkerJsPath = path
      const realSha = await checksum(workerJsPath, 'sha1').catch(e => undefined)
      const expectSha = await checksum(asarWorkerJsPath, 'sha1').catch(e => undefined)
      if (realSha !== expectSha) {
        logger.log('The worker js checksum not matched. Replace with the asar worker js.')
        await writeFile(workerJsPath, await readFile(asarWorkerJsPath))
      } else {
        logger.log('The worker js checksum matched. Skip to replace asar worker js.')
      }
    } else {
      logger.log('Skip to update worker js as this is DEV')
    }
  }
  const createLazyWorker = (factory: () => Worker) => {
    let threadWorker: Worker | undefined
    let counter = 0
    let destroyTimer: undefined | ReturnType<typeof setTimeout>
    const createWorker = () => {
      const worker = factory()
      logger.log(`Awake the worker ${factory}`)
      worker.on('message', (message: 'idle' | object) => {
        if (message === 'idle') {
          destroyTimer = setTimeout(() => {
            logger.log(`Dispose the worker ${factory}`)
            threadWorker?.terminate()
            threadWorker = undefined
            destroyTimer = undefined
          }, 1000 * 60)
        }
      })
      return worker
    }
    return new Proxy({} as any, {
      get(_, method) {
        return (...args: any[]) => {
          const _id = counter++
          return new Promise((resolve, reject) => {
            // create worker if not presented
            const worker = threadWorker || createWorker()
            threadWorker = worker
            const handler = (message: WorkerResponse | 'idle') => {
              if (message === 'idle') {
                return
              }
              const { error, result, id } = message
              if (id === _id) {
                worker.removeListener('message', handler)
                if (error) {
                  reject(error)
                } else {
                  resolve(result)
                }
              }
            }
            worker.addListener('message', handler)
            if (destroyTimer) {
              clearTimeout(destroyTimer)
            }
            worker.postMessage({ type: method, id: _id, args })
          })
        }
      },
    })
  }

  const resourceWorker: ResourceWorker = createLazyWorker(createResourceWorker)
  app.registry.register(kResourceWorker, resourceWorker)

  const encodingWorker: EncodingWorker = createLazyWorker(createEncodingWorker)
  app.registry.register(kEncodingWorker, encodingWorker)

  app.waitEngineReady().then(async () => {
    checkUpdate(resourceWorkerPath)
    checkUpdate(encodingWorkerPath)
  })
}
