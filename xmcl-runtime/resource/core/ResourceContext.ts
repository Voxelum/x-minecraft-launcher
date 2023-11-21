import { Kysely } from 'kysely'
import { EventEmitter } from 'stream'
import { ParseResourceArgs, ParseResourceResult } from '../parsers'
import { ImageStorage } from '~/lib/util/imageStore'
import { Logger } from '~/lib/util/log'
import { Database } from './schema'

export interface ResourceContext {
  readonly db: Kysely<Database>

  readonly image: ImageStorage

  readonly eventBus: EventEmitter

  readonly hash: (file: string, size: number) => Promise<string>
  readonly hashAndFileType: (file: string, size: number) => Promise<[string, string]>
  readonly parse: (resource: ParseResourceArgs) => Promise<ParseResourceResult>

  readonly logger: Logger
}
