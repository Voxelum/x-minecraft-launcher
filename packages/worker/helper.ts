import { MessagePort, parentPort } from 'worker_threads'
import type { WorkPayload } from './index'

export type GetSerializedErrorFunc = (
  error: Error,
  options: Record<string, unknown>,
) => Promise<unknown>

export function setHandler(_handlers: any, getSerializedErrorFunc: GetSerializedErrorFunc) {
  let handlers: Record<string, Function> = _handlers
  if (parentPort !== null) {
    main(parentPort)
  }
  let semaphore = 0
  const generators: Record<number, AsyncGenerator | undefined> = {}

  function main(port: MessagePort) {
    port.on('message', async (message: WorkPayload) => {
      const id = message.id
      const handler = (
        handlers as any as Record<string, (...message: any[]) => Promise<any> | AsyncGenerator>
      )[message.type]
      if (handler) {
        semaphore += 1
        const promise = generators[id] || handler(...message.args)
        const isAsyncGenerator = (v: unknown): v is AsyncGenerator => {
          return (
            !!v &&
            typeof (v as any).next === 'function' &&
            typeof (v as any)[Symbol.asyncIterator] === 'function'
          )
        }
        try {
          if (isAsyncGenerator(promise)) {
            generators[id] = promise
            const result = await promise.next()
            if (result.done) {
              delete generators[id]
            }
            port.postMessage({ result, id })
          } else {
            const result = await promise
            port.postMessage({ result, id })
          }
        } catch (error) {
          const err = error instanceof Error ? await getSerializedErrorFunc(error, {}) : error
          port.postMessage({
            error: err,
            id,
          })
        } finally {
          semaphore -= 1
          if (semaphore <= 0) {
            port.postMessage('idle')
          }
        }
      }
    })
  }
}
