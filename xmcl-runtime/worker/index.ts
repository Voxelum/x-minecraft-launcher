import { Worker } from 'worker_threads'
import { Logger } from '~/logger'

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
        if (destroyTimer) {
          clearTimeout(destroyTimer)
        }
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
          destroyTimer = undefined
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
