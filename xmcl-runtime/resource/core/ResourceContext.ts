import { Kysely } from 'kysely'
import { ImageStorage } from '~/imageStore'
import { Logger } from '~/logger'
import { ParseResourceArgs, ParseResourceResult } from '../parsers'
import { Database } from './schema'
import EventEmitter from 'events'

export interface ResourceContext {
  readonly db: Kysely<Database>
  readonly root: string

  isDatabaseOpened(): Promise<boolean>

  readonly image: ImageStorage
  readonly hash: (file: string, size: number) => Promise<string>
  readonly hashAndFileType: (file: string, size: number, isDir?: boolean) => Promise<[string, string]>
  readonly parse: (resource: ParseResourceArgs) => Promise<ParseResourceResult>

  readonly eventBus: EventEmitter

  readonly logger: Logger
}
