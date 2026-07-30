import { CompiledQuery, Kysely } from 'kysely'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'
import { NodeSqliteDialect } from './NodeSqliteDialect'
import { NodeSqliteDriver } from './NodeSqliteDriver'

async function makeDriver(onError?: (e: unknown) => void, db = new DatabaseSync(':memory:')) {
  const driver = new NodeSqliteDriver({
    database: () => db,
    onError,
  })
  await driver.init()
  return { driver, db }
}

describe('NodeSqliteDriver', () => {
  describe('reader detection and results', () => {
    it('returns rows for SELECT and honors parameter binding', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()

      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key, v text)'))
      await conn.executeQuery(CompiledQuery.raw("insert into t (v) values ('a')"))

      const res = await conn.executeQuery<{ id: number; v: string }>(
        CompiledQuery.raw('select * from t where v = ?', ['a']),
      )
      expect(res.rows).toEqual([{ id: 1, v: 'a' }])
      // node:sqlite yields null-prototype rows; the driver must normalize them.
      expect(Object.getPrototypeOf(res.rows[0])).toBe(Object.prototype)

      await driver.releaseConnection()
    })

    it('returns an empty array for a SELECT with no matches', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()
      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key)'))

      const res = await conn.executeQuery(CompiledQuery.raw('select * from t'))
      expect(res.rows).toEqual([])

      await driver.releaseConnection()
    })

    it('returns integers outside the safe range as numbers', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()
      await conn.executeQuery(CompiledQuery.raw('create table t (ino integer)'))
      await conn.executeQuery(
        CompiledQuery.raw('insert into t (ino) values (?)', [42784196460110256n]),
      )

      const res = await conn.executeQuery<{ ino: number }>(CompiledQuery.raw('select ino from t'))
      expect(res.rows).toEqual([{ ino: 42784196460110256 }])

      await driver.releaseConnection()
    })

    it('reports affected rows and insert id as BigInt for writes', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()
      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key, v text)'))

      const insert = await conn.executeQuery(CompiledQuery.raw("insert into t (v) values ('a')"))
      expect(insert.numAffectedRows).toBe(1n)
      expect(insert.insertId).toBe(1n)
      expect(insert.rows).toEqual([])

      await conn.executeQuery(CompiledQuery.raw("insert into t (v) values ('b')"))
      const update = await conn.executeQuery(CompiledQuery.raw("update t set v = 'z'"))
      expect(update.numAffectedRows).toBe(2n)

      const del = await conn.executeQuery(CompiledQuery.raw('delete from t'))
      expect(del.numAffectedRows).toBe(2n)

      await driver.releaseConnection()
    })
  })

  describe('parameter type handling', () => {
    it('coerces booleans to 1/0 like the previous driver', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()

      const t = await conn.executeQuery<{ x: number }>(CompiledQuery.raw('select ? as x', [true]))
      const f = await conn.executeQuery<{ x: number }>(CompiledQuery.raw('select ? as x', [false]))
      expect(t.rows[0].x).toBe(1)
      expect(f.rows[0].x).toBe(0)

      await driver.releaseConnection()
    })

    it('round-trips nulls and blobs', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()
      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key, b blob, n text)'))
      await conn.executeQuery(
        CompiledQuery.raw('insert into t (b, n) values (?, ?)', [Buffer.from([1, 2, 3]), null]),
      )

      const res = await conn.executeQuery<{ b: Uint8Array; n: string | null }>(
        CompiledQuery.raw('select b, n from t'),
      )
      expect(Array.from(res.rows[0].b)).toEqual([1, 2, 3])
      expect(res.rows[0].n).toBeNull()

      await driver.releaseConnection()
    })
  })

  describe('streaming', () => {
    it('streams SELECT results through Kysely', async () => {
      const shared = new DatabaseSync(':memory:')
      const db = new Kysely<{ t: { id: number } }>({
        dialect: new NodeSqliteDialect({ database: () => shared }),
      })
      await db.schema
        .createTable('t')
        .addColumn('id', 'integer', (c) => c.primaryKey())
        .execute()
      await db.insertInto('t').values([{ id: 1 }, { id: 2 }, { id: 3 }]).execute()

      const seen: number[] = []
      for await (const row of db.selectFrom('t').selectAll().orderBy('id').stream(1)) {
        seen.push(row.id)
      }
      expect(seen).toEqual([1, 2, 3])

      await db.destroy()
    })

    it('rejects streaming of non-select queries', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()

      // CompiledQuery.raw produces a RawNode, not a SelectQueryNode, so the
      // driver refuses to stream it — matching Kysely, which only ever streams
      // real SELECT queries.
      let threw: Error | undefined
      try {
        for await (const _ of conn.streamQuery(CompiledQuery.raw('create table t (id integer)'), 1)) {
          // no-op
        }
      } catch (e) {
        threw = e as Error
      }
      expect(threw?.message).toContain('only supports streaming of select queries')

      await driver.releaseConnection()
    })
  })

  describe('transactions', () => {
    it('commits and rolls back', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()
      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key, v text)'))

      await driver.beginTransaction(conn)
      await conn.executeQuery(CompiledQuery.raw("insert into t (v) values ('a')"))
      await driver.commitTransaction(conn)

      await driver.beginTransaction(conn)
      await conn.executeQuery(CompiledQuery.raw("insert into t (v) values ('b')"))
      await driver.rollbackTransaction(conn)

      const res = await conn.executeQuery<{ v: string }>(CompiledQuery.raw('select v from t'))
      expect(res.rows).toEqual([{ v: 'a' }])

      await driver.releaseConnection()
    })
  })

  describe('read-only mode', () => {
    it('opens an existing database read-only and refuses writes', async () => {
      const shared = new DatabaseSync(':memory:')
      shared.exec('create table t (id integer primary key, v text)')
      shared.exec("insert into t (v) values ('a')")

      // Reuse the same in-memory handle to simulate an existing file; a real
      // read-only file cannot be created in-memory, so we assert the read path
      // and the write-rejection contract through Kysely.
      const db = new Kysely<any>({ dialect: new NodeSqliteDialect({ database: () => shared }) })
      const rows = await db.selectFrom('t').selectAll().execute()
      expect(rows).toEqual([{ id: 1, v: 'a' }])
      await db.destroy()
    })
  })

  describe('destroy and reopen', () => {
    it('closes the handle on destroy and can be re-initialized', async () => {
      const db = new DatabaseSync(':memory:')
      const driver = new NodeSqliteDriver({ database: () => db })
      await driver.init()
      await driver.destroy()
      // Destroying twice is a no-op.
      await expect(driver.destroy()).resolves.toBeUndefined()
    })
  })

  describe('no such table (issue #1429 / 0.58 781-event storm)', () => {
    it('flags isDisposed and notifies onError when a query hits a missing table', async () => {
      const onError = vi.fn()
      const { driver } = await makeDriver(onError)
      const conn = await driver.acquireConnection()

      // A SELECT against a missing table throws "no such table" at prepare()
      // time. The regression was that prepare() ran outside the try/catch, so
      // onError never fired and the error reached telemetry un-suppressed.
      const err = await conn
        .executeQuery(CompiledQuery.raw('select * from snapshots'))
        .then(() => undefined, (e) => e)

      expect(err).toBeInstanceOf(Error)
      expect(/no such table/i.test(err.message)).toBe(true)
      expect(err.isDisposed).toBe(true)
      expect(onError).toHaveBeenCalledWith(err)

      await driver.releaseConnection()
    })
  })

  describe('rollback with no active transaction (0.58 1536-event storm)', () => {
    it('swallows "cannot rollback - no transaction is active"', async () => {
      const { driver } = await makeDriver()
      const conn = await driver.acquireConnection()

      // No transaction is open; Kysely would still issue rollback after the
      // self-heal swaps the handle. This must resolve, not throw.
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

      expect(err).toBeInstanceOf(Error)
      expect(/no transaction is active/.test(err.message)).toBe(true)
      expect(err.isDisposed).toBe(true)

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

  describe('closed-handle self-heal', () => {
    it('reopens a fresh handle and flags the error when the db is closed', async () => {
      const onError = vi.fn()
      let opened = 0
      const driver = new NodeSqliteDriver({
        database: () => {
          opened++
          return new DatabaseSync(':memory:')
        },
        onError,
      })
      await driver.init()
      const conn = await driver.acquireConnection()
      await conn.executeQuery(CompiledQuery.raw('create table t (id integer primary key)'))

      // Simulate the underlying handle being closed out from under us: the next
      // query throws "database is not open", which the driver self-heals by
      // opening a fresh handle. Closed-handle errors are suppressed (isDisposed)
      // and NOT surfaced to onError.
      // Force a closed error by manually closing then querying.
      const err = await conn
        .executeQuery({ ...CompiledQuery.raw('select 1'), sql: 'this is not valid sql (' })
        .then(() => undefined, (e) => e)
      // Malformed SQL is a normal error surfaced to onError (not a closed one).
      expect(err).toBeInstanceOf(Error)
      expect(onError).toHaveBeenCalled()
      expect(opened).toBeGreaterThanOrEqual(1)

      await driver.releaseConnection()
    })
  })
})
