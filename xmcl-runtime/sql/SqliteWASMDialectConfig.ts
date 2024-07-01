import { Database } from 'node-sqlite3-wasm'
import { DatabaseWorker } from './type'

export type SqliteWASMDialectDatabaseConfig = {
  database: Database
}
export type SqliteWASMDialectWorkerConfig = {
  worker: DatabaseWorker
}

export type SqliteWASMDialectConfig = SqliteWASMDialectDatabaseConfig | SqliteWASMDialectWorkerConfig
