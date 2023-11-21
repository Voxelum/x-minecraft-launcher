import { checksum } from '@xmcl/core'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import 'source-map-support/register'
import { copyPassively } from '../lib/util/fs'
import { hashAndFiletypeResource, hashResource } from '../resource/core/hashResource'
import { ResourceParser } from '../resource/parsers'
import { setHandler } from '../worker/helper'
import { ResourceWorker } from './worker'

gracefulify(fs)

const parser = new ResourceParser()

const handlers: ResourceWorker = {
  checksum: (path, algorithm) => checksum(path, algorithm),
  hash: (file, size) => hashResource(file, size),
  parse: (args) => parser.parse(args),
  async copyPassively(files): Promise<void> {
    await Promise.all(files.map(({ src, dest }) => copyPassively(src, dest)))
  },
  hashAndFileType: (file, size) => hashAndFiletypeResource(file, size),
}
setHandler(handlers)
