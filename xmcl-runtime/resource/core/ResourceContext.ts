import { Kysely } from 'kysely'
import { EventEmitter } from 'stream'
import { ParseResourceArgs, ParseResourceResult } from '../parsers'
import { ImageStorage } from '~/imageStore'
import { Logger } from '~/logger'
import { Database } from './schema'
import type { Database as SQLite } from 'better-sqlite3'

export interface ResourceContext {
  readonly db: Kysely<Database>
  readonly sqlite: SQLite

  readonly image: ImageStorage

  readonly eventBus: EventEmitter

  readonly hash: (file: string, size: number) => Promise<string>
  readonly hashAndFileType: (file: string, size: number) => Promise<[string, string]>
  readonly parse: (resource: ParseResourceArgs) => Promise<ParseResourceResult>

  readonly logger: Logger
}
