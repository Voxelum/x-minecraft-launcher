import SQLite from 'better-sqlite3'
import EventEmitter from 'events'
import { IdentifierNode, Kysely, KyselyPlugin, OperationNodeTransformer, ParseJSONResultsPlugin, PluginTransformQueryArgs, PluginTransformResultArgs, PrimitiveValueListNode, QueryResult, RootOperationNode, SqliteDialect, UnknownRow, ValueListNode, ValueNode } from 'kysely'
import { ImageStorage } from '../util/imageStore'
import { Logger } from '../util/log'
import { ResourceContext } from './ResourceContext'
import { Database } from './schema'

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
    return node
  }

  protected transformPrimitiveValueList(node: PrimitiveValueListNode): PrimitiveValueListNode {
    const values = node.values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)
    return PrimitiveValueListNode.create(values)
  }
}

export function createResourceContext(root: string, imageStore: ImageStorage, eventBus: EventEmitter, logger: Logger, delegates: Pick<ResourceContext, 'hash' | 'parse' | 'hashAndFileType'>) {
  const dialect = new SqliteDialect({
    database: new SQLite(root, {
    }),
  })

  // Database interface is passed to Kysely's constructor, and from now on, Kysely
  // knows your database structure.
  // Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
  // to communicate with your database.
  const db = new Kysely<Database>({
    dialect,
    plugins: [new ParseJSONResultsPlugin(), new JSONPlugin()],
  })

  const context: ResourceContext = {
    db,
    image: imageStore,
    hash: delegates.hash,
    hashAndFileType: delegates.hashAndFileType,
    parse: delegates.parse,
    eventBus,
    logger,
  }

  return context
}
