import { DatabaseConnection } from 'kysely'
import { Database } from 'node-sqlite3-wasm'

type SqliteWASMDialectConfigBase = {
  onError?: (error: unknown) => void
  databasePath?: string
}

export interface DatabaseWorker extends DatabaseConnection {
  init(): Promise<void>
  destroy(): Promise<void>
}

export type SqliteWASMDialectDatabaseConfig = {
  database: () => Database
} & SqliteWASMDialectConfigBase

export type SqliteWASMDialectWorkerConfig = {
  worker: DatabaseWorker
} & SqliteWASMDialectConfigBase

export type SqliteWASMDialectConfig =
  | SqliteWASMDialectDatabaseConfig
  | SqliteWASMDialectWorkerConfig
