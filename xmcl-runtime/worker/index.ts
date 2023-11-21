import { Logger } from '~/logger'
import { HAS_DEV_SERVER } from '~/constant'
import { checksum } from '~/util/fs'
import { readFile, writeFile } from 'fs/promises'
import { Worker } from 'worker_threads'

export const checkUpdate = async (path: string, logger: Logger) => {
  if (!HAS_DEV_SERVER) {
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

export const createLazyWorker = <T>(factory: () => Worker, methods: Array<keyof T>, logger: Logger): T => {
  let threadWorker: Worker | undefined
  let counter = 0
  let destroyTimer: undefined | ReturnType<typeof setTimeout>
  const queue: Record<number, { resolve: (r: any) => void; reject: (e: any) => void }> = {}
  const createWorker = () => {
    const worker = factory()
    logger.log(`Awake the worker ${factory}`)
    worker.on('message', (message: 'idle' | WorkerResponse) => {
      if (message === 'idle') {
        destroyTimer = setTimeout(() => {
          if (threadWorker) {
            logger.log(`Dispose the worker ${factory}`)
            threadWorker?.terminate()
            threadWorker = undefined
            destroyTimer = undefined
          }
        }, 1000 * 60)
        return
      }
      const { error, result, id } = message
      const handler = queue[id]
      if (!handler) {
        return
      }
      if (error) {
        handler.reject(error)
      } else {
        handler.resolve(result)
      }
      delete queue[id]
    })
    return worker
  }
  const obj = {} as T
  for (const method of methods) {
    (obj as any)[method] = (...args: any[]) => {
      const _id = counter++
      return new Promise((resolve, reject) => {
        // create worker if not presented
        queue[_id] = { resolve, reject }
        threadWorker = threadWorker || createWorker()
        if (destroyTimer) {
          clearTimeout(destroyTimer)
        }
        threadWorker.postMessage({ type: method, id: _id, args })
      })
    }
  }
  return obj
}

export interface WorkPayload {
  type: string
  id: number
  args: any[]
}

export interface ChecksumWorkPayload {
  algorithm: string
  path: string
}

export interface FileTypePayload {
  path: string
}

export interface WorkerResponse {
  id: number
  error?: Error
  result?: any
}
