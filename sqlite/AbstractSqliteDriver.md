# Class AbstractSqliteDriver

## 🏭 Constructors

### constructor

```ts
AbstractSqliteDriver(): AbstractSqliteDriver
```
#### Return Type

- `AbstractSqliteDriver`


## 🏷️ Properties

### connectionMutex <Badge type="tip" text="readonly" />

```ts
connectionMutex: ConnectionMutex = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L86" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:86</a>
</p>


## 🔧 Methods

### acquireConnection <Badge type="warning" text="abstract" />

```ts
acquireConnection(): Promise<DatabaseConnection>
```
Acquires a new connection from the pool.
#### Return Type

- `Promise<DatabaseConnection>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L89" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:89</a>
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

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L96" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:96</a>
</p>


### destroy <Badge type="warning" text="abstract" />

```ts
destroy(): Promise<void>
```
Destroys the driver and releases all resources.
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L90" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:90</a>
</p>


### init <Badge type="warning" text="abstract" />

```ts
init(): Promise<void>
```
Initializes the driver.

After calling this method the driver should be usable and ``acquireConnection`` etc.
methods should be callable.
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L88" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:88</a>
</p>


### releaseConnection

```ts
releaseConnection(): Promise<void>
```
Releases a connection back to the pool.
#### Return Type

- `Promise<void>`

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

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/NodeSqliteDriver.ts#L100" target="_blank" rel="noreferrer">packages/sqlite/NodeSqliteDriver.ts:100</a>
</p>


