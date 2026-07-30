import { existsSync, renameSync } from 'fs'
import { CompiledQuery, DatabaseConnection, Driver, QueryResult, SelectQueryNode } from 'kysely'
import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { NodeSqliteDialectConfig } from './NodeSqliteDialectConfig'

// Messages that indicate the on-disk database file is unrecoverable and
// will keep producing the same error for every subsequent query. Reopening
// the same file does not help: we must move the file aside so `database()`
// creates a fresh one. See issue #1429.
const CORRUPT_MESSAGES = [
  'database disk image is malformed',
  'file is not a database',
  'file is encrypted or is not a database',
]

/**
 * `node:sqlite` reports the closed-handle state through these messages. The old
 * `node-sqlite3-wasm` driver used "database already closed"; the built-in module
 * uses "database is not open". Both are handled so the recovery contract from
 * issue #1429 keeps working across the engine change.
 */
const CLOSED_MESSAGES = [
  'database already closed',
  'database is not open',
  'unable to open database file',
]

/**
 * Mark an error as already-handled so the telemetry sink in xmcl-runtime can
 * skip it instead of re-reporting it for every subsequent query.
 */
function markDisposed(e: unknown) {
  if (e && typeof e === 'object') {
    ;(e as { isDisposed?: boolean }).isDisposed = true
  }
}

/**
 * `node:sqlite` only accepts `null | number | bigint | string | Buffer |
 * TypedArray | DataView` as bound parameters and requires them to be spread,
 * not passed as an array. Kysely, however, emits `boolean` values which the old
 * `node-sqlite3-wasm` driver silently coerced to `1`/`0`. Preserve that
 * behavior so existing queries keep binding the same values.
 */
function bindParameters(parameters: readonly unknown[]): unknown[] {
  return parameters.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p))
}

/**
 * `node:sqlite` returns rows as `null`-prototype objects and throws when an
 * integer does not fit in JavaScript's safe range. Statements read integers as
 * BigInt, so normalize them back to the driver's existing number contract and
 * return plain objects for downstream Kysely plugins and callers.
 */
function toPlainRow<O>(row: O): O {
  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? Number(value) : value,
    ]),
  ) as O
}

/**
 * Decide whether a prepared statement yields rows. This is the faithful port of
 * the old WASM `isReader()` monkey patch, which used `sqlite3_column_count >= 1`.
 * `StatementSync.columns()` (Node >= 22.16) exposes the same information; when it
 * is unavailable we fall back to the query-node/SQL heuristic.
 */
function isReaderStatement(stmt: StatementSync, query: unknown, sql: string): boolean {
  const columns = (stmt as unknown as { columns?: () => unknown[] }).columns
  if (typeof columns === 'function') {
    try {
      return columns.call(stmt).length > 0
    } catch {
      // fall through to the heuristic
    }
  }
  if (query && SelectQueryNode.is(query as any)) {
    return true
  }
  return /^\s*(select|with|pragma)/i.test(sql)
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
    try {
      await connection.executeQuery(CompiledQuery.raw('rollback'))
    } catch (e) {
      // After the self-heal swaps in a fresh db handle (issue #1429), the
      // transaction we opened died with the old handle, so the new
      // connection has no active transaction and `rollback` fails with
      // "cannot rollback - no transaction is active". That rollback is
      // moot — the work is already gone — so swallow it instead of
      // letting Kysely surface it (and mask the real error that aborted
      // the transaction). 0.58 telemetry: 1536 events / 3 users.
      if (e instanceof Error && e.message.includes('no transaction is active')) {
        return
      }
      throw e
    }
  }

  async releaseConnection(): Promise<void> {
    this.connectionMutex.unlock()
  }
}

export class NodeSqliteDriver extends AbstractSqliteDriver {
  readonly #config: NodeSqliteDialectConfig

  #db?: DatabaseSync
  #connection?: SqliteConnection
  #destroyed = false

  constructor(config: NodeSqliteDialectConfig) {
    super()
    this.#config = { ...config }
  }

  async init(): Promise<void> {
    this.#db = this.#config.database()
    const onError = (e: unknown) => {
      if (this.#destroyed) {
        markDisposed(e)
        return
      }
      if (!(e instanceof Error)) {
        this.#config.onError?.(e)
        return
      }
      // SQLite reports messages in lowercase (e.g. "database is locked").
      // Normalize before matching so the recovery below is not skipped and
      // every resource-worker retry does not reach telemetry.
      const message = e.message.toLowerCase()
      if (message === 'database is locked' || CLOSED_MESSAGES.includes(message)) {
        // The underlying handle is gone (or locked). Open a fresh one and swap
        // it in place — the existing SqliteConnection picks up the new handle
        // through its getter so callers that already acquired the connection
        // don't keep hitting the closed db in a tight loop (root cause of
        // issue #1429).
        try {
          this.#db?.close()
        } catch {}
        try {
          this.#db = this.#config.database()
        } catch {
          // Best-effort: if we can't even open a fresh handle, leave the
          // existing one in place. Subsequent errors are still flagged below.
        }
        markDisposed(e)
      } else if (CORRUPT_MESSAGES.includes(message)) {
        // The file itself is corrupt. Reopening the same file would just
        // produce the same error on every query — the flood that turned the
        // original "Database already closed" fix from #1429 into the 0.56.4
        // "disk image is malformed" storm (~1860 events/user). Move the bad
        // file aside, open a fresh one, and let the higher-level retry loop in
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
          // Best-effort: see above.
        }
        markDisposed(e)
        // Surface to the consumer exactly once so it can mark the database as
        // not-ready / show a "please restart" hint.
        this.#config.onError?.(e)
      } else if (message.startsWith('no such table')) {
        // Schema isn't present — either the migration never ran on this file or
        // it ran on a sibling that's since been swapped out. Don't retry: just
        // flag the error so the telemetry sink suppresses the per-query repeat,
        // and let the consumer notice via `databaseReadySet(false)`.
        markDisposed(e)
        this.#config.onError?.(e)
      } else if (message.includes('no transaction is active')) {
        // Benign fallout of the self-heal: after we swap in a fresh db handle
        // (issue #1429), Kysely still issues a `rollback` for the transaction
        // that died with the old handle, which fails with "cannot rollback - no
        // transaction is active". The rollback is moot, so flag it for telemetry
        // suppression instead of storming (0.58: 1536 ev / 3 users). Don't mark
        // the database not-ready — it's perfectly usable.
        markDisposed(e)
      } else {
        this.#config.onError?.(e)
      }
    }
    this.#connection = new SqliteConnection(() => this.#db!, onError)
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    // SQLite only has one single connection. We use a mutex here to wait until
    // the single connection has been released.
    await this.connectionMutex.lock()
    return this.#connection!
  }

  async destroy(): Promise<void> {
    if (this.#destroyed) {
      return
    }
    this.#destroyed = true
    try {
      this.#db?.close()
    } catch {}
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly #getDb: () => DatabaseSync

  constructor(
    getDb: () => DatabaseSync,
    private onError?: (error: unknown) => void,
  ) {
    this.#getDb = getDb
  }

  executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters, query } = compiledQuery

    try {
      // `prepare` must run inside the try: preparing a SELECT against a missing
      // table throws "no such table" here, and we want that to reach `onError`
      // (which flags `isDisposed` for telemetry suppression).
      const stmt = this.#getDb().prepare(sql)
      const params = bindParameters(parameters)
      if (isReaderStatement(stmt, query, sql)) {
        stmt.setReadBigInts(true)
        const rows = stmt.all(...(params as [])) as O[]
        return Promise.resolve({ rows: rows.map(toPlainRow) })
      }
      const { changes, lastInsertRowid } = stmt.run(...(params as []))

      const numAffectedRows =
        changes !== undefined && changes !== null ? BigInt(changes) : undefined

      return Promise.resolve({
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
    }
    // node:sqlite prepared statements are finalized on garbage collection and
    // when the database closes, so there is no explicit `finalize()` to call
    // (unlike the old node-sqlite3-wasm driver).
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { sql, parameters, query } = compiledQuery
    try {
      const stmt = this.#getDb().prepare(sql)
      if (SelectQueryNode.is(query)) {
        stmt.setReadBigInts(true)
        const iter = stmt.iterate(...(bindParameters(parameters) as [])) as IterableIterator<R>
        for (const row of iter) {
          yield {
            rows: [toPlainRow(row)],
          }
        }
      } else {
        throw new Error('Sqlite driver only supports streaming of select queries')
      }
    } catch (e) {
      this.onError?.(e)
      throw e
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
