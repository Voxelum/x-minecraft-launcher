import { CompiledQuery, DatabaseConnection, Driver, QueryResult, SelectQueryNode } from 'kysely'
import type { Database } from 'node-sqlite3-wasm'
import { SqliteWASMDialectDatabaseConfig, SqliteWASMDialectWorkerConfig } from './SqliteWASMDialectConfig'

declare module 'node-sqlite3-wasm' {
  interface Statement {
    isReader(): boolean
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
  constructor(
    private config: SqliteWASMDialectWorkerConfig) {
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
  #connection?: DatabaseConnection

  constructor(config: SqliteWASMDialectDatabaseConfig) {
    super()
    this.#config = ({ ...config })
  }

  async init(): Promise<void> {
    this.#db = this.#config.database
    this.#connection = new SqliteConnection(this.#db)
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    // SQLite only has one single connection. We use a mutex here to wait
    // until the single connection has been released.
    await this.connectionMutex.lock()
    return this.#connection!
  }

  async destroy(): Promise<void> {
    this.#db?.close()
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery
    const stmt = this.#db.prepare(sql)

    try {
      if (stmt.isReader()) {
        return Promise.resolve({
          rows: stmt.all(parameters as any) as O[],
        })
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
    } finally {
      stmt.finalize()
    }
  }

  async * streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { sql, parameters, query } = compiledQuery
    const stmt = this.#db.prepare(sql)
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
