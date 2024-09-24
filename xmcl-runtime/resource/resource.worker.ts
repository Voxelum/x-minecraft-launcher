import { checksum } from '@xmcl/core'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import { setHandler } from '../worker/helper'
import { hashAndFiletypeResource, hashResource } from './core/hashResource'
import { fingerprint } from './fingerprint'
import { ResourceParser } from './parsers'
import type { ResourceWorker } from './worker'

gracefulify(fs)

const parser = new ResourceParser()

const handlers: ResourceWorker = {
  checksum: (path, algorithm) => checksum(path, algorithm),
  fingerprint,
  hash: (file, size) => hashResource(file, size),
  parse: (args) => parser.parse(args),
  hashAndFileType: (file, size, dir) => hashAndFiletypeResource(file, size, dir),
}
setHandler(handlers)
