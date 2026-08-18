import { MessagePort, parentPort } from 'worker_threads'
import type { WorkPayload } from './index'

export type GetSerializedErrorFunc = (
  error: Error,
  options: Record<string, unknown>,
) => Promise<unknown>

export interface HandlerOptions {
  concurrency?: Record<string, number | undefined>
}

export function setHandler(
  _handlers: any,
  getSerializedErrorFunc: GetSerializedErrorFunc,
  options: HandlerOptions = {},
) {
  let handlers: Record<string, Function> = _handlers
  if (parentPort !== null) {
    main(parentPort)
  }
  let semaphore = 0
  const generators: Record<number, AsyncGenerator | undefined> = {}
  const gates = new Map<string, { active: number; waiters: Array<() => void> }>()

  async function acquire(type: string) {
    const limit = options.concurrency?.[type]
    if (!limit || limit < 1) return () => {}

    let gate = gates.get(type)
    if (!gate) {
      gate = { active: 0, waiters: [] }
      gates.set(type, gate)
    }
    if (gate.active < limit) {
      gate.active += 1
    } else {
      await new Promise<void>((resolve) => gate.waiters.push(resolve))
    }

    let released = false
    return () => {
      if (released) return
      released = true
      const next = gate.waiters.shift()
      if (next) {
        next()
      } else {
        gate.active -= 1
        if (gate.active === 0) gates.delete(type)
      }
    }
  }

  function main(port: MessagePort) {
    port.on('message', async (message: WorkPayload) => {
      const id = message.id
      const handler = (
        handlers as any as Record<string, (...message: any[]) => Promise<any> | AsyncGenerator>
      )[message.type]
      if (handler) {
        semaphore += 1
        const isAsyncGenerator = (v: unknown): v is AsyncGenerator => {
          return (
            !!v &&
            typeof (v as any).next === 'function' &&
            typeof (v as any)[Symbol.asyncIterator] === 'function'
          )
        }
        let release = () => {}
        try {
          release = await acquire(message.type)
          const promise = generators[id] || handler(...message.args)
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
          release()
          semaphore -= 1
          if (semaphore <= 0) {
            port.postMessage('idle')
          }
        }
      }
    })
  }
}
