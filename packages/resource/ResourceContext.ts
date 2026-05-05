import EventEmitter from 'events'
import { Kysely } from 'kysely'
import type { ParseResourceArgs, ParseResourceResult } from './parsers'
import { Database } from './schema'
import { ResourceState } from './ResourcesState'

export interface ResourceContext {
  readonly db: Kysely<Database>

  readonly root: string

  hashAndFileType(file: string, size: number, isDir?: boolean): Promise<[string, string]>

  parse(resource: ParseResourceArgs): Promise<ParseResourceResult>

  cacheImage(buf: Uint8Array): Promise<string>

  createResourceState(): ResourceState

  event: EventEmitter

  onError(e: Error): void

  throwException(exception: { type: 'parseResourceException'; code: string }): never
}
