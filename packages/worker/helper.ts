import { MessagePort, parentPort } from 'worker_threads'
import type { WorkPayload } from './index'

export type GetSerializedErrorFunc = (
  error: Error,
  options: Record<string, unknown>,
) => Promise<unknown>

export interface HandlerOptions {
  concurrency?: Record<string, number | undefined>
  concurrencyGroups?: Record<string, string | undefined>
  priorities?: Record<string, ((...args: any[]) => number | undefined) | undefined>
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
  const gates = new Map<string, {
    active: number
    waiters: Array<{ priority: number; resolve: () => void }>
  }>()

  async function acquire(type: string, priority: number) {
    const gateKey = options.concurrencyGroups?.[type] ?? type
    const limit = options.concurrency?.[gateKey]
    if (!limit || limit < 1) return () => {}

    let gate = gates.get(gateKey)
    if (!gate) {
      gate = { active: 0, waiters: [] }
      gates.set(gateKey, gate)
    }
    if (gate.active < limit) {
      gate.active += 1
    } else {
      await new Promise<void>((resolve) => {
        const waiter = { priority, resolve }
        const index = gate.waiters.findIndex((queued) => queued.priority < priority)
        if (index === -1) {
          gate.waiters.push(waiter)
        } else {
          gate.waiters.splice(index, 0, waiter)
        }
      })
    }

    let released = false
    return () => {
      if (released) return
      released = true
      const next = gate.waiters.shift()
      if (next) {
        next.resolve()
      } else {
        gate.active -= 1
        if (gate.active === 0) gates.delete(gateKey)
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
          const priority = options.priorities?.[message.type]?.(...message.args) ?? 0
          release = await acquire(message.type, priority)
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
