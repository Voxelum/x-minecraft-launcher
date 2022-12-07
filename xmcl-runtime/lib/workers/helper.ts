import { MessagePort, parentPort } from 'worker_threads'
import { WorkPayload } from '../entities/resourceWorker'

if (parentPort !== null) {
  main(parentPort)
}
let semaphore = 0
let handlers: Record<string, Function> = {}

function main(port: MessagePort) {
  port.on('message', (message: WorkPayload) => {
    const id = message.id
    const handler = (handlers as any as Record<string, (...message: any[]) => Promise<any>>)[message.type]
    if (handler) {
      semaphore += 1
      handler(...message.args).then((result) => {
        port.postMessage({ result, id })
      }, (error) => {
        port.postMessage({ error, id })
      }).finally(() => {
        semaphore -= 1
        if (semaphore <= 0) {
          port.postMessage('idle')
        }
      })
    }
  })
}

export function setHandler(handler: any) {
  handlers = handler
}
