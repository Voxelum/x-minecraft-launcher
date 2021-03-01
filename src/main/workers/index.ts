import { readHeader } from '/@main/entities/resource'
import { ChecksumWorkPayload, ReadResourceWorkPayload, WorkPayload } from '/@main/entities/worker'
import { checksum } from '@xmcl/core'
import { MessagePort, parentPort } from 'worker_threads'

if (parentPort !== null) {
  main(parentPort)
}

const handlers: Record<string, (message: any) => Promise<any>> = {
  checksum: (m: ChecksumWorkPayload) => checksum(m.path, m.algorithm),
  readResourceHeader: (m: ReadResourceWorkPayload) => readHeader(m.path, m.hash, m.type)
}

function main (port: MessagePort) {
  port.on('message', (message: WorkPayload) => {
    const id = message.id
    const handler = handlers[message.type]
    if (handler) {
      handler(message).then((result) => {
        port.postMessage({ result, id })
      }, (error) => {
        port.postMessage({ error, id })
      })
    }
  })
}
