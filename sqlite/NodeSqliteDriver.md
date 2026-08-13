# Class NodeSqliteDriver

## 🏭 Constructors

### constructor

```ts
NodeSqliteDriver(config: NodeSqliteDialectConfig): NodeSqliteDriver
```
#### Parameters

- **config**: `NodeSqliteDialectConfig`
#### Return Type

- `NodeSqliteDriver`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L130" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:130</a>
</p>


## 🏷️ Properties

### connectionMutex <Badge type="tip" text="readonly" />

```ts
connectionMutex: ConnectionMutex = ...
```
*Inherited from: `AbstractSqliteDriver.connectionMutex`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L86" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:86</a>
</p>


## 🔧 Methods

### acquireConnection

```ts
acquireConnection(): Promise<DatabaseConnection>
```
Acquires a new connection from the pool.
#### Return Type

- `Promise<DatabaseConnection>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L213" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:213</a>
</p>


### beginTransaction

```ts
beginTransaction(connection: DatabaseConnection): Promise<void>
```
Begins a transaction.
#### Parameters

- **connection**: `DatabaseConnection`
#### Return Type

- `Promise<void>`

*Inherited from: `AbstractSqliteDriver.beginTransaction`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L92" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:92</a>
</p>


### commitTransaction

```ts
commitTransaction(connection: DatabaseConnection): Promise<void>
```
Commits a transaction.
#### Parameters

- **connection**: `DatabaseConnection`
#### Return Type

- `Promise<void>`

*Inherited from: `AbstractSqliteDriver.commitTransaction`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L96" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:96</a>
</p>


### destroy

```ts
destroy(): Promise<void>
```
Destroys the driver and releases all resources.
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L220" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:220</a>
</p>


### init

```ts
init(): Promise<void>
```
Initializes the driver.

After calling this method the driver should be usable and ``acquireConnection`` etc.
methods should be callable.
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L135" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:135</a>
</p>


### releaseConnection

```ts
releaseConnection(): Promise<void>
```
Releases a connection back to the pool.
#### Return Type

- `Promise<void>`

*Inherited from: `AbstractSqliteDriver.releaseConnection`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L118" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:118</a>
</p>


### rollbackTransaction

```ts
rollbackTransaction(connection: DatabaseConnection): Promise<void>
```
Rolls back a transaction.
#### Parameters

- **connection**: `DatabaseConnection`
#### Return Type

- `Promise<void>`

*Inherited from: `AbstractSqliteDriver.rollbackTransaction`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L100" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:100</a>
</p>


