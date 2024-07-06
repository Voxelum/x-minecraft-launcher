import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import type { CompiledQuery, DatabaseConnection, QueryResult } from 'kysely'
import { Database } from 'node-sqlite3-wasm'
import { setHandler } from '../worker/helper'
import { workerData, parentPort } from 'worker_threads'
import { DatabaseWorker } from './type'

gracefulify(fs)

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
      if (query.kind === 'SelectQueryNode') {
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

let db: Database | undefined
let conn: SqliteConnection | undefined
let error: any

try {
  const { fileName, options } = workerData
  db = new Database(fileName, options)
  conn = new SqliteConnection(db)
} catch (e) {
  error = e
}

const handler: DatabaseWorker = {
  executeQuery: async function <R>(compiledQuery: CompiledQuery<unknown>): Promise<QueryResult<R>> {
    if (!conn) throw error || new Error('Database not ready')
    return conn.executeQuery<R>(compiledQuery)
  },
  streamQuery: function <R>(compiledQuery: CompiledQuery<unknown>, chunkSize: number): AsyncIterableIterator<QueryResult<R>> {
    if (!conn) throw error || new Error('Database not ready')
    return conn.streamQuery<R>(compiledQuery, chunkSize)
  },
  init() {
    if (error) return Promise.reject(error)
    return Promise.resolve()
  },
  async destroy() {
    db?.close()
  },
}

setHandler(handler)
