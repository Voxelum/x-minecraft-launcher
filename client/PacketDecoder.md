# Class PacketDecoder

## 🏭 Constructors

### constructor

```ts
PacketDecoder(client: PacketRegistry): PacketDecoder
```
#### Parameters

- **client**: `PacketRegistry`
#### Return Type

- `PacketDecoder`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L272" target="_blank" rel="noreferrer">packages/client/channel.ts:272</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L278" target="_blank" rel="noreferrer">packages/client/channel.ts:278</a>
</p>


### readPacketId <Badge type="warning" text="abstract" />

```ts
readPacketId(message: ByteBuffer): number
```
#### Parameters

- **message**: `ByteBuffer`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L276" target="_blank" rel="noreferrer">packages/client/channel.ts:276</a>
</p>


