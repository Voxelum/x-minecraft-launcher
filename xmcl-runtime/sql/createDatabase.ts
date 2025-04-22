import { Kysely, KyselyPlugin, OperationNodeTransformer, ParseJSONResultsPlugin, PluginTransformQueryArgs, PluginTransformResultArgs, PrimitiveValueListNode, QueryResult, RootOperationNode, UnknownRow, ValueNode } from 'kysely'
import { Logger } from '~/logger'
import { SqliteWASMDialect } from './SqliteWASMDialect'
import { SqliteWASMDialectConfig } from './SqliteWASMDialectConfig'

class JSONPlugin implements KyselyPlugin {
  #tranformer = new JSONTransformer()

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    if (args.node.kind === 'InsertQueryNode' || args.node.kind === 'UpdateQueryNode') {
      return this.#tranformer.transformNode(args.node)
    }
    return args.node
  }

  transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(args.result)
  }
}
class JSONTransformer extends OperationNodeTransformer {
  constructor() {
    super()
  }

  protected override transformValue(node: ValueNode): ValueNode {
    if (typeof node.value === 'object') {
      return ValueNode.create(JSON.stringify(node.value))
    }
    return node
  }

  protected override transformPrimitiveValueList(node: PrimitiveValueListNode): PrimitiveValueListNode {
    const values = node.values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)
    node = PrimitiveValueListNode.create(values)
    return node
  }
}


export async function createDatabase<T>(dbOptions: SqliteWASMDialectConfig, migrate: (db: Kysely<T>, logger: Logger) => Promise<boolean>, logger: Logger) {
  const dialect = new SqliteWASMDialect(dbOptions)
  // Database interface is passed to Kysely's constructor, and from now on, Kysely
  // knows your database structure.
  // Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
  // to communicate with your database.
  const db = new Kysely<T>({
    dialect,
    plugins: [new ParseJSONResultsPlugin(), new JSONPlugin()],
    log: (e) => {
      if (e.level === 'error') {
        logger.warn(e.query.sql + '\n[' + e.query.parameters.join(', ') + ']', (e.error as Error).message)
      }
    },
  })

  const result = await migrate(db, logger)

  return [db, result] as const
}