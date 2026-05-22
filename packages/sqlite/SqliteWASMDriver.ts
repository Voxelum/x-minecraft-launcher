import { CompiledQuery, DatabaseConnection, Driver, QueryResult, SelectQueryNode } from 'kysely'
import type { Database } from 'node-sqlite3-wasm'
import { SQLite3Error } from 'node-sqlite3-wasm'
import {
  SqliteWASMDialectDatabaseConfig,
  SqliteWASMDialectWorkerConfig,
} from './SqliteWASMDialectConfig'
import { existsSync, renameSync, rmSync } from 'fs'

// Messages that indicate the on-disk database file is unrecoverable and
// will keep producing the same SQLite3Error for every subsequent query.
// Reopening the same file does not help: we must move the file aside so
// `database()` creates a fresh one. See issue #1429.
const CORRUPT_MESSAGES = [
  'database disk image is malformed',
  'file is not a database',
  'file is encrypted or is not a database',
]

declare module 'node-sqlite3-wasm' {
  interface Statement {
    isReader(): boolean
  }

  interface SQLite3Error {
    /**
     * This mean this error can be ignore since the database/connection has been disposed.
     */
    isDisposed?: boolean
  }
}

export abstract class AbstractSqliteDriver implements Driver {
  readonly connectionMutex = new ConnectionMutex()

  abstract init(): Promise<void>
  abstract acquireConnection(): Promise<DatabaseConnection>
  abstract destroy(): Promise<void>

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin'))
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
  }

  async releaseConnection(): Promise<void> {
    this.connectionMutex.unlock()
  }
}

export class SqliteWASMWorkerDriver extends AbstractSqliteDriver {
  constructor(private config: SqliteWASMDialectWorkerConfig) {
    super()
  }

  async init(): Promise<void> {
    await this.config.worker.init()
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    await this.connectionMutex.lock()
    return this.config.worker
  }

  destroy(): Promise<void> {
    return this.config.worker.destroy()
  }
}

export class SqliteWASMDriver extends AbstractSqliteDriver {
  readonly #config: SqliteWASMDialectDatabaseConfig

  #db?: Database
  #connection?: SqliteConnection
  #destroyed = false

  constructor(config: SqliteWASMDialectDatabaseConfig) {
    super()
    this.#config = { ...config }
  }

  async init(): Promise<void> {
    this.#db = this.#config.database()
    const onError = (e: unknown) => {
      if (!this.#destroyed) {
        if (e instanceof Error) {
          if (e.message === 'Database is locked') {
            try {
              if (this.#config.databasePath) {
                const lockPath = this.#config.databasePath + '.lock'
                if (existsSync(lockPath)) {
                  rmSync(lockPath, { recursive: true })
                }
              }
            } catch {}
          }
          if (
            e.message === 'Database is locked' ||
            e.message === 'Database already closed' ||
            e.message === 'unable to open database file'
          ) {
            // The underlying handle is gone. Open a fresh one and swap it in
            // place — the existing SqliteConnection picks up the new handle
            // through its getter so callers that already acquired the
            // connection don't keep hitting the closed db in a tight loop
            // (root cause of issue #1429).
            try {
              this.#db?.close()
            } catch {}
            this.#db = this.#config.database()
            // Mark the original error as already-handled so the telemetry
            // sink in xmcl-runtime can skip it instead of re-reporting it
            // for every subsequent query.
            if (e instanceof SQLite3Error) {
              e.isDisposed = true
            }
          } else if (CORRUPT_MESSAGES.includes(e.message)) {
            // The file itself is corrupt. Reopening the same file would
            // just produce the same error on every query — flood that
            // turned the original "Database already closed" fix from
            // #1429 into the 0.56.4 "disk image is malformed" storm
            // (~1860 events/user). Move the bad file aside, open a
            // fresh one, and let the higher-level retry loop in
            // `pluginResourceWorker` re-run migrations on next launch.
            try {
              this.#db?.close()
            } catch {}
            try {
              if (this.#config.databasePath && existsSync(this.#config.databasePath)) {
                const bk = `${this.#config.databasePath}.corrupt.${Date.now()}.bk`
                renameSync(this.#config.databasePath, bk)
              }
            } catch {}
            try {
              this.#db = this.#config.database()
            } catch {
              // Best-effort: if we can't even open a fresh handle,
              // leave the existing one in place. Subsequent errors
              // will still be flagged isDisposed below.
            }
            if (e instanceof SQLite3Error) {
              e.isDisposed = true
            }
            // Surface to the consumer exactly once so it can mark the
            // database as not-ready / show a "please restart" hint.
            this.#config.onError?.(e)
          } else if (e.message.startsWith('no such table')) {
            // Schema isn't present — either the migration never ran on
            // this file or it ran on a sibling that's since been
            // swapped out. Don't retry: just flag the error so the
            // telemetry sink suppresses the per-query repeat, and let
            // the consumer notice via `databaseReadySet(false)`.
            if (e instanceof SQLite3Error) {
              e.isDisposed = true
            }
            this.#config.onError?.(e)
          } else {
            this.#config.onError?.(e)
          }
        } else {
          this.#config.onError?.(e)
        }
      } else {
        if (e instanceof SQLite3Error) {
          e.isDisposed = true
        }
      }
    }
    this.#connection = new SqliteConnection(() => this.#db!, onError)
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    // SQLite only has one single connection. We use a mutex here to wait
    // until the single connection has been released.
    await this.connectionMutex.lock()
    return this.#connection!
  }

  async destroy(): Promise<void> {
    if (this.#destroyed) {
      return
    }
    this.#destroyed = true
    this.#db?.close()
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly #getDb: () => Database

  constructor(
    getDb: () => Database,
    private onError?: (error: unknown) => void,
  ) {
    this.#getDb = getDb
  }

  executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery
    const stmt = this.#getDb().prepare(sql)

    try {
      if (stmt.isReader()) {
        const rows = stmt.all(parameters as any) as O[]
        return Promise.resolve({ rows })
      }
      const { changes, lastInsertRowid } = stmt.run(parameters as any)

      const numAffectedRows =
        changes !== undefined && changes !== null ? BigInt(changes) : undefined

      return Promise.resolve({
        numUpdatedOrDeletedRows: numAffectedRows,
        numAffectedRows,
        insertId:
          lastInsertRowid !== undefined && lastInsertRowid !== null
            ? BigInt(lastInsertRowid)
            : undefined,
        rows: [],
      })
    } catch (e) {
      this.onError?.(e)
      return Promise.reject(e)
    } finally {
      stmt.finalize()
    }
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { sql, parameters, query } = compiledQuery
    const stmt = this.#getDb().prepare(sql)
    try {
      if (SelectQueryNode.is(query)) {
        const iter = stmt.iterate(parameters as any) as IterableIterator<R>
        for (const row of iter) {
          yield {
            rows: [row],
          }
        }
      } else {
        throw new Error('Sqlite driver only supports streaming of select queries')
      }
    } finally {
      stmt.finalize()
    }
  }
}

class ConnectionMutex {
  #promise?: Promise<void>
  #resolve?: () => void

  async lock(): Promise<void> {
    while (this.#promise) {
      await this.#promise
    }

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  unlock(): void {
    const resolve = this.#resolve

    this.#promise = undefined
    this.#resolve = undefined

    resolve?.()
  }
}
