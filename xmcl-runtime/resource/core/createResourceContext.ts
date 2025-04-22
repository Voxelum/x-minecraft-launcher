import EventEmitter from 'events'
import { Kysely } from 'kysely'
import { ImageStorage } from '~/imageStore'
import { Logger } from '~/logger'
import { ResourceContext } from './ResourceContext'
import { Database } from './schema'

export function createResourceContext(root: string, imageStore: ImageStorage, eventBus: EventEmitter, logger: Logger, delegates: Pick<ResourceContext, 'hash' | 'parse' | 'hashAndFileType'>, db: Kysely<Database>) {
  const context: ResourceContext = {
    db,
    image: imageStore,
    hash: delegates.hash,
    hashAndFileType: delegates.hashAndFileType,
    parse: delegates.parse,
    logger,
    root,
    eventBus,
  }

  return context
}
