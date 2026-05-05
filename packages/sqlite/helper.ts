import {
  SelectQueryBuilder,
  RawBuilder,
  Simplify,
  sql,
  Expression,
  SelectQueryNode,
  AliasNode,
  ColumnNode,
  ExpressionWrapper,
  IdentifierNode,
  ReferenceNode,
  TableNode,
  ValueNode,
  KyselyPlugin,
  OperationNodeTransformer,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  PrimitiveValueListNode,
  QueryResult,
  RootOperationNode,
  UnknownRow,
} from 'kysely'

export class JSONPlugin implements KyselyPlugin {
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

  protected override transformPrimitiveValueList(
    node: PrimitiveValueListNode,
  ): PrimitiveValueListNode {
    const values = node.values.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))
    node = PrimitiveValueListNode.create(values)
    return node
  }
}

function getJsonObjectArgs(node: SelectQueryNode, table: string): Expression<unknown>[] {
  const args: Expression<unknown>[] = []

  for (const { selection: s } of node.selections ?? []) {
    if (ReferenceNode.is(s) && ColumnNode.is(s.column)) {
      args.push(colName(s.column.column.name), colRef(table, s.column.column.name))
    } else if (ColumnNode.is(s)) {
      args.push(colName(s.column.name), colRef(table, s.column.name))
    } else if (AliasNode.is(s) && IdentifierNode.is(s.alias)) {
      args.push(colName(s.alias.name), colRef(table, s.alias.name))
    } else {
      throw new Error("can't extract column names from the select query node")
    }
  }

  return args
}

function colName(col: string): Expression<unknown> {
  return new ExpressionWrapper(ValueNode.createImmediate(col))
}

function colRef(table: string, col: string): Expression<unknown> {
  return new ExpressionWrapper(
    ReferenceNode.create(ColumnNode.create(col), TableNode.create(table)),
  )
}

/**
 * A SQLite helper for aggregating a subquery into a JSON array.
 *
 * NOTE: This helper only works correctly if you've installed the `ParseJSONResultsPlugin`.
 * Otherwise the nested selections will be returned as JSON strings.
 *
 * The plugin can be installed like this:
 *
 * ```ts
 * const db = new Kysely({
 *   dialect: new SqliteDialect(config),
 *   plugins: [new ParseJSONResultsPlugin()]
 * })
 * ```
 *
 * ### Examples
 *
 * ```ts
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonArrayFrom(
 *       eb.selectFrom('pet')
 *         .select(['pet.id as pet_id', 'pet.name'])
 *         .whereRef('pet.owner_id', '=', 'person.id')
 *         .orderBy('pet.name')
 *     ).as('pets')
 *   ])
 *   .execute()
 *
 * result[0].id
 * result[0].pets[0].pet_id
 * result[0].pets[0].name
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select "id", (
 *   select coalesce(json_group_array(json_object(
 *     'pet_id', "agg"."pet_id",
 *     'name', "agg"."name"
 *   )), '[]') from (
 *     select "pet"."id" as "pet_id", "pet"."name"
 *     from "pet"
 *     where "pet"."owner_id" = "person"."id"
 *     order by "pet"."name"
 *   ) as "agg"
 * ) as "pets"
 * from "person"
 * ```
 */
export function jsonArrayFrom<O>(expr: SelectQueryBuilder<any, any, O>): RawBuilder<Simplify<O>[]> {
  return sql`(select coalesce(json_group_array(json_object(${sql.join(
    getSqliteJsonObjectArgs(expr.toOperationNode(), 'agg'),
  )})), '[]') from ${expr} as agg)`
}

/**
 * A SQLite helper for turning a subquery into a JSON object.
 *
 * The subquery must only return one row.
 *
 * NOTE: This helper only works correctly if you've installed the `ParseJSONResultsPlugin`.
 * Otherwise the nested selections will be returned as JSON strings.
 *
 * The plugin can be installed like this:
 *
 * ```ts
 * const db = new Kysely({
 *   dialect: new SqliteDialect(config),
 *   plugins: [new ParseJSONResultsPlugin()]
 * })
 * ```
 *
 * ### Examples
 *
 * ```ts
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonObjectFrom(
 *       eb.selectFrom('pet')
 *         .select(['pet.id as pet_id', 'pet.name'])
 *         .whereRef('pet.owner_id', '=', 'person.id')
 *         .where('pet.is_favorite', '=', true)
 *     ).as('favorite_pet')
 *   ])
 *   .execute()
 *
 * result[0].id
 * result[0].favorite_pet.pet_id
 * result[0].favorite_pet.name
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select "id", (
 *   select json_object(
 *     'pet_id', "obj"."pet_id",
 *     'name', "obj"."name"
 *   ) from (
 *     select "pet"."id" as "pet_id", "pet"."name"
 *     from "pet"
 *     where "pet"."owner_id" = "person"."id"
 *     and "pet"."is_favorite" = ?
 *   ) as obj
 * ) as "favorite_pet"
 * from "person";
 * ```
 */
export function jsonObjectFrom<O>(
  expr: SelectQueryBuilder<any, any, O>,
): RawBuilder<Simplify<O> | null> {
  return sql`(select json_object(${sql.join(
    getSqliteJsonObjectArgs(expr.toOperationNode(), 'obj'),
  )}) from ${expr} as obj)`
}

/**
 * The SQLite `json_object` function.
 *
 * NOTE: This helper only works correctly if you've installed the `ParseJSONResultsPlugin`.
 * Otherwise the nested selections will be returned as JSON strings.
 *
 * The plugin can be installed like this:
 *
 * ```ts
 * const db = new Kysely({
 *   dialect: new SqliteDialect(config),
 *   plugins: [new ParseJSONResultsPlugin()]
 * })
 * ```
 *
 * ### Examples
 *
 * ```ts
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonBuildObject({
 *       first: eb.ref('first_name'),
 *       last: eb.ref('last_name'),
 *       full: sql<string>`first_name || ' ' || last_name`
 *     }).as('name')
 *   ])
 *   .execute()
 *
 * result[0].id
 * result[0].name.first
 * result[0].name.last
 * result[0].name.full
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select "id", json_object(
 *   'first', first_name,
 *   'last', last_name,
 *   'full', "first_name" || ' ' || "last_name"
 * ) as "name"
 * from "person"
 * ```
 */
export function jsonBuildObject<O extends Record<string, Expression<unknown>>>(
  obj: O,
): RawBuilder<
  Simplify<{
    [K in keyof O]: O[K] extends Expression<infer V> ? V : never
  }>
> {
  return sql`json_object(${sql.join(Object.keys(obj).flatMap((k) => [sql.lit(k), obj[k]]))})`
}

function getSqliteJsonObjectArgs(node: SelectQueryNode, table: string): Expression<unknown>[] {
  try {
    return getJsonObjectArgs(node, table)
  } catch {
    throw new Error(
      'SQLite jsonArrayFrom and jsonObjectFrom functions can only handle explicit selections due to limitations of the json_object function. selectAll() is not allowed in the subquery.',
    )
  }
}
