# Class Transport

## 🏭 Constructors

### constructor

```ts
Transport(options: TransportOptions): Transport
```
#### Parameters

- **options**: `TransportOptions`
#### Return Type

- `Transport`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L271" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:271</a>
</p>


## 🏷️ Properties

### client <Badge type="tip" text="readonly" />

```ts
client: Client
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L265" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:265</a>
</p>


## 🔑 Accessors

### isConnected

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L267" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:267</a>
</p>


## 🔧 Methods

### addListener

```ts
addListener(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).addListener`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L8" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:8</a>
</p>


### close <Badge type="warning" text="abstract" />

```ts
close(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L280" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:280</a>
</p>


### connect <Badge type="warning" text="abstract" />

```ts
connect(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L277" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:277</a>
</p>


### emit

```ts
emit(event: E, args: Parameters<TransportEvents[E]>): boolean
```
#### Parameters

- **event**: `E`
- **args**: `Parameters<TransportEvents[E]>`
#### Return Type

- `boolean`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).emit`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L18" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:18</a>
</p>


### eventNames

```ts
eventNames(): (string | symbol)[]
```
#### Return Type

- `(string | symbol)[]`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).eventNames`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L19" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:19</a>
</p>


### getMaxListeners

```ts
getMaxListeners(): number
```
#### Return Type

- `number`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).getMaxListeners`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L24" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:24</a>
</p>


### listenerCount

```ts
listenerCount(event: E): number
```
#### Parameters

- **event**: `E`
#### Return Type

- `number`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).listenerCount`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L22" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:22</a>
</p>


### listeners

```ts
listeners(event: E): TransportEvents[E][]
```
#### Parameters

- **event**: `E`
#### Return Type

- `TransportEvents[E][]`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).listeners`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L21" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:21</a>
</p>


### off

```ts
off(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).off`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L14" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:14</a>
</p>


### on

```ts
on(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).on`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L9" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:9</a>
</p>


### once

```ts
once(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).once`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L10" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:10</a>
</p>


### ping <Badge type="warning" text="abstract" />

```ts
ping(): void
```
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L279" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:279</a>
</p>


### prependListener

```ts
prependListener(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).prependListener`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L11" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:11</a>
</p>


### prependOnceListener

```ts
prependOnceListener(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).prependOnceListener`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L12" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:12</a>
</p>


### rawListeners

```ts
rawListeners(event: E): TransportEvents[E][]
```
#### Parameters

- **event**: `E`
#### Return Type

- `TransportEvents[E][]`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).rawListeners`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L20" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:20</a>
</p>


### removeAllListeners

```ts
removeAllListeners(event: E): this
```
#### Parameters

- **event**: `E`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).removeAllListeners`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L15" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:15</a>
</p>


### removeListener

```ts
removeListener(event: E, listener: TransportEvents[E]): this
```
#### Parameters

- **event**: `E`
- **listener**: `TransportEvents[E]`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).removeListener`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L16" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:16</a>
</p>


### send <Badge type="warning" text="abstract" />

```ts
send(data: any): void
```
#### Parameters

- **data**: `any`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L278" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:278</a>
</p>


### setMaxListeners

```ts
setMaxListeners(maxListeners: number): this
```
#### Parameters

- **maxListeners**: `number`
#### Return Type

- `this`

*Inherited from: `(EventEmitter as new () => TypedEmitter<TransportEvents>).setMaxListeners`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/utils/TypedEmitter.ts#L25" target="_blank" rel="noreferrer">packages/discord-rpc/utils/TypedEmitter.ts:25</a>
</p>


