# Interface Coder

The packet encode/decode algorithm
## 🏷️ Properties

### decode <Badge type="tip" text="readonly" />

```ts
decode: (buffer: ByteBuffer, context?: PacketRegistry) => T
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L19" target="_blank" rel="noreferrer">packages/client/coders.ts:19</a>
</p>


### encode <Badge type="tip" text="readonly" />

```ts
encode: (buffer: ByteBuffer, data: T, context?: PacketRegistry) => void
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L18" target="_blank" rel="noreferrer">packages/client/coders.ts:18</a>
</p>


