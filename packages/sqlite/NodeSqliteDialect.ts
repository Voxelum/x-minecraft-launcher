import {
  DatabaseIntrospector,
  Dialect,
  DialectAdapter,
  Driver,
  Kysely,
  QueryCompiler,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'
import { NodeSqliteDialectConfig } from './NodeSqliteDialectConfig'
import { NodeSqliteDriver } from './NodeSqliteDriver'

/**
 * A Kysely dialect backed by Node's built-in `node:sqlite` module. It preserves
 * the SQLite adapter/introspector/compiler behavior while owning a single
 * `DatabaseSync` connection through {@link NodeSqliteDriver}.
 */
export class NodeSqliteDialect implements Dialect {
  constructor(readonly config: NodeSqliteDialectConfig) {}

  createDriver(): Driver {
    return new NodeSqliteDriver(this.config)
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler()
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db)
  }
}
