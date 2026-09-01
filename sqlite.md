## 🧾 Classes

<div class="definition-grid class"><a href="sqlite/AbstractSqliteDriver">AbstractSqliteDriver</a><a href="sqlite/JSONPlugin">JSONPlugin</a><a href="sqlite/NodeSqliteDialect">NodeSqliteDialect</a><a href="sqlite/NodeSqliteDriver">NodeSqliteDriver</a></div>

## 🏭 Functions

### jsonArrayFrom

```ts
jsonArrayFrom(expr: SelectQueryBuilder<any, any, O>): RawBuilder<Simplify<O>[]>
```
A SQLite helper for aggregating a subquery into a JSON array.

NOTE: This helper only works correctly if you've installed the ``ParseJSONResultsPlugin``.
Otherwise the nested selections will be returned as JSON strings.

The plugin can be installed like this:

````ts
const db = new Kysely({
  dialect: new SqliteDialect(config),
  plugins: [new ParseJSONResultsPlugin()]
})
````

### Examples

````ts
const result = await db
  .selectFrom('person')
  .select((eb) => [
    'id',
    jsonArrayFrom(
      eb.selectFrom('pet')
        .select(['pet.id as pet_id', 'pet.name'])
        .whereRef('pet.owner_id', '=', 'person.id')
        .orderBy('pet.name')
    ).as('pets')
  ])
  .execute()

result[0].id
result[0].pets[0].pet_id
result[0].pets[0].name
````

The generated SQL (SQLite):

````sql
select "id", (
  select coalesce(json_group_array(json_object(
    'pet_id', "agg"."pet_id",
    'name', "agg"."name"
  )), '[]') from (
    select "pet"."id" as "pet_id", "pet"."name"
    from "pet"
    where "pet"."owner_id" = "person"."id"
    order by "pet"."name"
  ) as "agg"
) as "pets"
from "person"
````
#### Parameters

- **expr**: `SelectQueryBuilder<any, any, O>`
#### Return Type

- `RawBuilder<Simplify<O>[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/helper.ts#L147" target="_blank" rel="noreferrer">packages/sqlite/helper.ts:147</a>
</p>


### jsonBuildObject

```ts
jsonBuildObject(obj: O): RawBuilder<Simplify<{ [K in string | number | symbol]: O[K] extends Expression<V> ? V : never }>>
```
The SQLite ``json_object`` function.

NOTE: This helper only works correctly if you've installed the ``ParseJSONResultsPlugin``.
Otherwise the nested selections will be returned as JSON strings.

The plugin can be installed like this:

````ts
const db = new Kysely({
  dialect: new SqliteDialect(config),
  plugins: [new ParseJSONResultsPlugin()]
})
````

### Examples

````ts
const result = await db
  .selectFrom('person')
  .select((eb) => [
    'id',
    jsonBuildObject({
      first: eb.ref('first_name'),
      last: eb.ref('last_name'),
      full: sql<string>`first_name || ' ' || last_name`
    }).as('name')
  ])
  .execute()

result[0].id
result[0].name.first
result[0].name.last
result[0].name.full
````

The generated SQL (SQLite):

````sql
select "id", json_object(
  'first', first_name,
  'last', last_name,
  'full', "first_name" || ' ' || "last_name"
) as "name"
from "person"
````
#### Parameters

- **obj**: `O`
#### Return Type

- `RawBuilder<Simplify<{ [K in string | number | symbol]: O[K] extends Expression<V> ? V : never }>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/helper.ts#L263" target="_blank" rel="noreferrer">packages/sqlite/helper.ts:263</a>
</p>


### jsonObjectFrom

```ts
jsonObjectFrom(expr: SelectQueryBuilder<any, any, O>): RawBuilder<Simplify<O> | null>
```
A SQLite helper for turning a subquery into a JSON object.

The subquery must only return one row.

NOTE: This helper only works correctly if you've installed the ``ParseJSONResultsPlugin``.
Otherwise the nested selections will be returned as JSON strings.

The plugin can be installed like this:

````ts
const db = new Kysely({
  dialect: new SqliteDialect(config),
  plugins: [new ParseJSONResultsPlugin()]
})
````

### Examples

````ts
const result = await db
  .selectFrom('person')
  .select((eb) => [
    'id',
    jsonObjectFrom(
      eb.selectFrom('pet')
        .select(['pet.id as pet_id', 'pet.name'])
        .whereRef('pet.owner_id', '=', 'person.id')
        .where('pet.is_favorite', '=', true)
    ).as('favorite_pet')
  ])
  .execute()

result[0].id
result[0].favorite_pet.pet_id
result[0].favorite_pet.name
````

The generated SQL (SQLite):

````sql
select "id", (
  select json_object(
    'pet_id', "obj"."pet_id",
    'name', "obj"."name"
  ) from (
    select "pet"."id" as "pet_id", "pet"."name"
    from "pet"
    where "pet"."owner_id" = "person"."id"
    and "pet"."is_favorite" = ?
  ) as obj
) as "favorite_pet"
from "person";
````
#### Parameters

- **expr**: `SelectQueryBuilder<any, any, O>`
#### Return Type

- `RawBuilder<Simplify<O> | null>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/helper.ts#L208" target="_blank" rel="noreferrer">packages/sqlite/helper.ts:208</a>
</p>



## ⏩ Type Aliases

### NodeSqliteDialectConfig

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialectConfig.ts#L7" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialectConfig.ts:7</a>
</p>



