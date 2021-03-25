import { checksum } from '@xmcl/core'
import { createHash } from 'crypto'
import { FileExtension, stream } from 'file-type'
import { createReadStream } from 'fs'
import { MessagePort, parentPort } from 'worker_threads'
import { fileType, pipeline } from '../util/fs'
import { resolveResource } from '/@main/entities/resource'
import { ChecksumWorkPayload, CPUWorker, ResolveResourceWorkPayload, WorkPayload } from '/@main/entities/worker'

if (parentPort !== null) {
  main(parentPort)
}

const handlers: CPUWorker = {
  fileType: (m) => fileType(m.path),
  checksum: (m: ChecksumWorkPayload) => checksum(m.path, m.algorithm),
  checksumAndFileType: (m: ChecksumWorkPayload) => checksumAndFileType(m.path, m.algorithm),
  resolveResource: (m: ResolveResourceWorkPayload) => resolveResource(m.path, m.fileType, m.sha1, m.stat, m.hint),
}

async function checksumAndFileType(path: string, algorithm: string): Promise<[string, FileExtension | 'unknown' ]> {
  const readStream = await stream(createReadStream(path))
  const hashStream = createHash(algorithm).setEncoding('hex')
  await pipeline(readStream, hashStream)
  const fileType = readStream.fileType?.ext ?? 'unknown'
  const hash = hashStream.digest('hex')
  return [hash, fileType]
}

function main(port: MessagePort) {
  port.on('message', (message: WorkPayload) => {
    const id = message.id
    const handler = (handlers as any as Record<string, (message: any) => Promise<any>>)[message.type]
    if (handler) {
      handler(message).then((result) => {
        port.postMessage({ result, id })
      }, (error) => {
        port.postMessage({ error, id })
      })
    }
  })
}
