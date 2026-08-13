# Class PacketOutbound

## 🏭 Constructors

### constructor

```ts
PacketOutbound(channelWidth: number= Number.MAX_SAFE_INTEGER, opts: TransformOptions<Transform>): PacketOutbound
```
#### Parameters

- **channelWidth**: `number`
- **opts**: `TransformOptions<Transform>`
#### Return Type

- `PacketOutbound`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L342" target="_blank" rel="noreferrer">packages/client/channel.ts:342</a>
</p>


## 🔧 Methods

### _transform

```ts
_transform(packet: Buffer, encoding: string, callback: TransformCallback): void
```
#### Parameters

- **packet**: `Buffer`
- **encoding**: `string`
- **callback**: `TransformCallback`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L349" target="_blank" rel="noreferrer">packages/client/channel.ts:349</a>
</p>


### writePacketLength <Badge type="warning" text="protected" /> <Badge type="warning" text="abstract" />

```ts
writePacketLength(bb: ByteBuffer, len: number): void
```
#### Parameters

- **bb**: `ByteBuffer`
- **len**: `number`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L340" target="_blank" rel="noreferrer">packages/client/channel.ts:340</a>
</p>


