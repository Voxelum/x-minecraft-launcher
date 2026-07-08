import { CompiledQuery } from 'kysely'
import { Database, SQLite3Error } from 'node-sqlite3-wasm'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SqliteWASMDriver } from './SqliteWASMDriver'

// In production `isReader` is injected into the node-sqlite3-wasm dist at
// build time (see xmcl-electron-app/plugins/esbuild.native.plugin.ts) using
// the internal `sqlite3.column_count` binding, which isn't reachable from the
// raw npm package under vitest. Replicate it here with a SQL-prefix heuristic
// by tagging each prepared statement with its source SQL.
beforeAll(() => {
  const probe = new Database(':memory:')
  const sample = probe.prepare('select 1') as any
  const proto = Object.getPrototypeOf(sample)
  if (typeof proto.isReader !== 'function') {
    const origPrepare = Database.prototype.prepare
    Database.prototype.prepare = function (sql: string) {
      const stmt = origPrepare.call(this, sql) as any
      stmt.__sql = sql
      return stmt
    }
    proto.isReader = function (this: any) {
      return /^\s*(select|with|pragma)/i.test(this.__sql ?? '')
    }
  }
  sample.finalize()
  probe.close()
})

async function makeDriver(onError?: (e: unknown) => void) {
  const db = new Database(':memory:')
  const driver = new SqliteWASMDriver({
    database: () => db,
    onError,
  })
  await driver.init()
  return { driver, db }
}

describe('SqliteWASMDriver', () => {
  describe('no such table (issue #1429 / 0.58 781-event storm)', () => {
    it('flags isDisposed and notifies onError when a query hits a missing table', async () => {
      const onError = vi.fn()
      const { driver } = await makeDriver(onError)
      const conn = await driver.acquireConnection()

      // A SELECT against a missing table throws "no such table" at
      // prepare() time. The regression was that prepare() ran outside the
      // try/catch, so onError never fired and the error reached telemetry
      // un-suppressed.
      const err = await conn
        .executeQuery(CompiledQuery.raw('select * from snapshots'))
        .then(() => undefined, (e) => e)

      expect(err).toBeInstanceOf(SQLite3Error)
      expect(/no such table/.test(err.message)).toBe(true)
      expect((err as any).isDisposed).toBe(true)
      expect(onError).toHaveBeenCalledWith(err)

      await driver.releaseConnection()
    })
  })

  describe('rollback with no active transaction (0.58 1536-event storm)', () => {
    it('swallows "cannot rollback - no transaction is active"', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()

      // No transaction is open; Kysely would still issue rollback after
      // the self-heal swaps the handle. This must resolve, not throw.
      await expect(driver.rollbackTransaction(conn)).resolves.toBeUndefined()

      await driver.releaseConnection()
    })

    it('flags the underlying rollback error as isDisposed for telemetry', async () => {
      const onError = vi.fn()
      const { driver } = await makeDriver(onError)
      const conn = await driver.acquireConnection()

      const err = await conn
        .executeQuery(CompiledQuery.raw('rollback'))
        .then(() => undefined, (e) => e)

      expect(err).toBeInstanceOf(SQLite3Error)
      expect(/no transaction is active/.test(err.message)).toBe(true)
      expect((err as any).isDisposed).toBe(true)

      await driver.releaseConnection()
    })

    it('still propagates non-benign rollback errors', async () => {
      const { driver } = await makeDriver()
      const failing = {
        executeQuery: vi.fn().mockRejectedValue(new Error('disk I/O error')),
      } as any

      await expect(driver.rollbackTransaction(failing)).rejects.toThrow('disk I/O error')
    })
  })

  describe('happy path', () => {
    it('runs DDL/DML/queries through a real transaction', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()

      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key, v text)'))
      await driver.beginTransaction(conn)
      await conn.executeQuery(CompiledQuery.raw("insert into t (v) values ('a')"))
      await driver.commitTransaction(conn)

      const res = await conn.executeQuery<{ id: number; v: string }>(
        CompiledQuery.raw('select * from t'),
      )
      expect(res.rows).toEqual([{ id: 1, v: 'a' }])

      await driver.releaseConnection()
    })
  })
})
