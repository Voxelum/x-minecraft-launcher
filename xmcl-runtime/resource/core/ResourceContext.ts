import { Kysely } from 'kysely'
import { EventEmitter } from 'stream'
import { ImageStorage } from '~/imageStore'
import { Logger } from '~/logger'
import { ParseResourceArgs, ParseResourceResult } from '../parsers'
import { Database } from './schema'

export interface ResourceContext {
  readonly db: Kysely<Database>

  isDatabaseOpened(): Promise<boolean>

  readonly image: ImageStorage

  readonly eventBus: EventEmitter

  readonly hash: (file: string, size: number) => Promise<string>
  readonly hashAndFileType: (file: string, size: number) => Promise<[string, string]>
  readonly parse: (resource: ParseResourceArgs) => Promise<ParseResourceResult>

  readonly logger: Logger
}
