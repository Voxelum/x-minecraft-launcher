import { checksum } from '@xmcl/core'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import { setHandler } from '../worker/helper'
import { hashAndFiletypeResource, hashResource } from './core/hashResource'
import { fingerprint } from './fingerprint'
import { ResourceParser } from './parsers'
import type { ResourceWorker } from './worker'
import { crc32 } from '@aws-crypto/crc32'
import { readFile } from 'fs-extra'

gracefulify(fs)

const parser = new ResourceParser()

const handlers: ResourceWorker = {
  checksum: async (path, algorithm) => {
    if (algorithm === 'crc32') {
      return crc32(await readFile(path))
    }
    return checksum(path, algorithm)
  },
  fingerprint,
  hash: (file, size) => hashResource(file, size),
  parse: (args) => parser.parse(args),
  hashAndFileType: (file, size, dir) => hashAndFiletypeResource(file, size, dir),
}
setHandler(handlers)
