import { checksum } from '@xmcl/core'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import { setHandler } from '@xmcl/worker/helper'
import { hashAndFiletypeResource, hashResource, ResourceParser } from '@xmcl/resource'
import { fingerprint } from './fingerprint'
import type { ResourceWorker } from './worker'
import { crc32 } from '@aws-crypto/crc32'
import { readFile } from 'fs-extra'
import { getSerializedError } from '~/infra/errors/error_serialize'

gracefulify(fs)

const parser = new ResourceParser()
const HASH_CONCURRENCY = 64

const handlers: ResourceWorker = {
  checksum: async (path, algorithm, _priority) => {
    if (algorithm === 'crc32') {
      return crc32(await readFile(path))
    }
    return checksum(path, algorithm)
  },
  fingerprint,
  hash: (file, size) => hashResource(file, size),
  parse: (args) => parser.parse(args),
  hashAndFileType: (file, size, dir, _priority) => hashAndFiletypeResource(file, size, dir),
}
setHandler(handlers, getSerializedError, {
  concurrency: { hashing: HASH_CONCURRENCY },
  concurrencyGroups: { checksum: 'hashing', hashAndFileType: 'hashing' },
  priorities: {
    checksum: (_path, _algorithm, priority = 0) => priority,
    hashAndFileType: (_file, _size, _dir, priority = 0) => priority,
  },
})
