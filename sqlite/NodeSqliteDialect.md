# Class NodeSqliteDialect

A Kysely dialect backed by Node's built-in ``node:sqlite`` module. It preserves
the SQLite adapter/introspector/compiler behavior while owning a single
``DatabaseSync`` connection through [NodeSqliteDriver](NodeSqliteDriver).
## 🏭 Constructors

### constructor

```ts
NodeSqliteDialect(config: NodeSqliteDialectConfig): NodeSqliteDialect
```
#### Parameters

- **config**: `NodeSqliteDialectConfig`
#### Return Type

- `NodeSqliteDialect`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialect.ts#L21" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialect.ts:21</a>
</p>


## 🏷️ Properties

### config <Badge type="tip" text="readonly" />

```ts
config: NodeSqliteDialectConfig
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialect.ts#L21" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialect.ts:21</a>
</p>


## 🔧 Methods

### createAdapter

```ts
createAdapter(): DialectAdapter
```
Creates an adapter for the dialect.
#### Return Type

- `DialectAdapter`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialect.ts#L31" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialect.ts:31</a>
</p>


### createDriver

```ts
createDriver(): Driver
```
Creates a driver for the dialect.
#### Return Type

- `Driver`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialect.ts#L23" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialect.ts:23</a>
</p>


### createIntrospector

```ts
createIntrospector(db: Kysely<any>): DatabaseIntrospector
```
Creates a database introspector that can be used to get database metadata
such as the table names and column names of those tables.

``db`` never has any plugins installed. It's created using
[Kysely.withoutPlugins].
#### Parameters

- **db**: `Kysely<any>`
#### Return Type

- `DatabaseIntrospector`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialect.ts#L35" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialect.ts:35</a>
</p>


### createQueryCompiler

```ts
createQueryCompiler(): QueryCompiler
```
Creates a query compiler for the dialect.
#### Return Type

- `QueryCompiler`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDialect.ts#L27" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDialect.ts:27</a>
</p>


