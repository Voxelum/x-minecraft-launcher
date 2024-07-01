import { checksum } from '@xmcl/core'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import { copyPassively } from '~/util/fs'
import { hashAndFiletypeResource, hashResource } from './core/hashResource'
import { ResourceParser } from './parsers'
import { setHandler } from '../worker/helper'
import type { ResourceWorker } from './worker'
import { fingerprint } from './fingerprint'

gracefulify(fs)

const parser = new ResourceParser()

const handlers: ResourceWorker = {
  checksum: (path, algorithm) => checksum(path, algorithm),
  fingerprint,
  hash: (file, size) => hashResource(file, size),
  parse: (args) => parser.parse(args),
  async copyPassively(files): Promise<void> {
    await Promise.all(files.map(({ src, dest }) => copyPassively(src, dest)))
  },
  hashAndFileType: (file, size) => hashAndFiletypeResource(file, size),
}
setHandler(handlers)
