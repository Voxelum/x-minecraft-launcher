import { DatabaseWorker } from '@xmcl/sqlite'
import { setHandler } from '@xmcl/worker/helper'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import type { CompiledQuery, DatabaseConnection, QueryResult } from 'kysely'
import { Database } from 'node-sqlite3-wasm'
import { workerData } from 'worker_threads'
import { getSerializedError } from '~/infra/errors/error_serialize'

gracefulify(fs)

class SqliteConnection implements DatabaseConnection {
  readonly #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery
    let stmt: ReturnType<Database['prepare']> | undefined

    try {
      // Prepare inside the try so "no such table" (thrown at prepare
      // time) is funnelled through the same rejection path as runtime
      // errors instead of escaping synchronously. Mirrors the
      // main-thread SqliteWASMDriver.
      stmt = this.#db.prepare(sql)
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
      // Finalizing an errored statement can throw and mask the real
      // error; the handle is discarded either way.
      try {
        stmt?.finalize()
      } catch {}
    }
  }

  async * streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { sql, parameters, query } = compiledQuery
    let stmt: ReturnType<Database['prepare']> | undefined
    try {
      stmt = this.#db.prepare(sql)
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
      try {
        stmt?.finalize()
      } catch {}
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

setHandler(handler, getSerializedError)
