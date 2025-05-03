import { Database } from 'node-sqlite3-wasm'
import { DatabaseWorker } from './type'

type SqliteWASMDialectConfigBase = {
  onError?: (error: Error) => void
  databasePath?: string
}

export type SqliteWASMDialectDatabaseConfig = {
  database: () => Database
} & SqliteWASMDialectConfigBase

export type SqliteWASMDialectWorkerConfig = {
  worker: DatabaseWorker
} & SqliteWASMDialectConfigBase

export type SqliteWASMDialectConfig = (SqliteWASMDialectDatabaseConfig | SqliteWASMDialectWorkerConfig) 