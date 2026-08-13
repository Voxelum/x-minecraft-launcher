# Class PacketInBound

## 🏭 Constructors

### constructor <Badge type="tip" text="export" />

```ts
PacketInBound(opts: TransformOptions<Transform>): PacketInBound
```
#### Parameters

- **opts**: `TransformOptions<Transform>`
#### Return Type

- `PacketInBound`

*Inherited from: `Transform.constructor`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/node_modules/.pnpm/@types+node@24.13.3/node_modules/@types/node/stream.d.ts#L1282" target="_blank" rel="noreferrer">node_modules/.pnpm/@types+node@24.13.3/node_modules/@types/node/stream.d.ts:1282</a>
</p>


## 🔧 Methods

### _transform

```ts
_transform(chunk: Buffer, encoding: string, callback: TransformCallback): void
```
#### Parameters

- **chunk**: `Buffer`
- **encoding**: `string`
- **callback**: `TransformCallback`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L196" target="_blank" rel="noreferrer">packages/client/channel.ts:196</a>
</p>


### readPacketLength <Badge type="warning" text="protected" /> <Badge type="warning" text="abstract" />

```ts
readPacketLength(bb: ByteBuffer): number
```
#### Parameters

- **bb**: `ByteBuffer`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L194" target="_blank" rel="noreferrer">packages/client/channel.ts:194</a>
</p>


