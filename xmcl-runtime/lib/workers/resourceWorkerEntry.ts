import { checksum } from '@xmcl/core'
import { Resource } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import type { FileExtension } from 'file-type'
import fs, { createReadStream } from 'fs'
import { gracefulify } from 'graceful-fs'
import { parseResourceMetadata } from '../entities/resource'
import { ResourceWorker } from '../entities/resourceWorker'
import { copyPassively, fileType, pipeline } from '../util/fs'

import { setHandler } from './helper'

gracefulify(fs)

const handlers: ResourceWorker = {
  fileType: (path) => fileType(path),
  checksum: (path, algorithm) => checksum(path, algorithm),
  checksumAndFileType: (path, algorithm) => checksumAndFileType(path, algorithm),
  parseResourceMetadata: (m: Resource) => parseResourceMetadata(m),
  async copyPassively(files): Promise<void> {
    await Promise.all(files.map(({ src, dest }) => copyPassively(src, dest)))
  },
  validateResources(resource: Resource[]) {
    throw new Error('Function not implemented.')
  },
}
setHandler(handlers)

async function checksumAndFileType(path: string, algorithm: string): Promise<[string, FileExtension | 'unknown']> {
  const { stream } = await import('file-type')
  const readStream = await stream(createReadStream(path))
  const hashStream = createHash(algorithm).setEncoding('hex')
  await pipeline(readStream, hashStream)
  const fileType = readStream.fileType?.ext ?? 'unknown'
  const hash = hashStream.digest('hex')
  return [hash, fileType]
}
