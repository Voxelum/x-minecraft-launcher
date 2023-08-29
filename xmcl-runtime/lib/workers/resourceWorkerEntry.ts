import { checksum } from '@xmcl/core'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import { ResourceWorker } from '../entities/resourceWorker'
import { hashAndFiletypeResource, hashResource } from '../resources'
import { copyPassively } from '../util/fs'
import 'source-map-support/register'

import { setHandler } from './helper'
import { ResourceParser } from '../resourceParsers'

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
