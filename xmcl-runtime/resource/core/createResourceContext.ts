import EventEmitter from 'events'
import { Kysely, KyselyPlugin, OperationNodeTransformer, ParseJSONResultsPlugin, PluginTransformQueryArgs, PluginTransformResultArgs, PrimitiveValueListNode, QueryResult, RootOperationNode, UnknownRow, ValueNode } from 'kysely'
import { ImageStorage } from '~/imageStore'
import { Logger } from '~/logger'
import { DatabaseWorker, SqliteWASMDialect, SqliteWASMDialectConfig } from '~/sql'
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

export function createResourceContext(imageStore: ImageStorage, eventBus: EventEmitter, logger: Logger, delegates: Pick<ResourceContext, 'hash' | 'parse' | 'hashAndFileType'>, dbOptions: SqliteWASMDialectConfig) {
  const dialect = new SqliteWASMDialect(dbOptions)

  // Database interface is passed to Kysely's constructor, and from now on, Kysely
  // knows your database structure.
  // Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
  // to communicate with your database.
  const db = new Kysely<Database>({
    dialect,
    plugins: [new ParseJSONResultsPlugin(), new JSONPlugin()],
    log: (e) => {
      if (e.level === 'error') {
        logger.warn(e.query.sql + '\n[' + e.query.parameters.join(', ') + ']')
      }
    },
  })

  const context: ResourceContext = {
    db,
    isDatabaseOpened: async () => 'database' in dbOptions ? dbOptions.database.isOpen : dbOptions.worker.init().then(() => true, () => false),
    image: imageStore,
    hash: delegates.hash,
    hashAndFileType: delegates.hashAndFileType,
    parse: delegates.parse,
    eventBus,
    logger,
  }

  return context
}
