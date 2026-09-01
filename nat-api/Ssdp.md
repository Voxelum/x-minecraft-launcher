# Class Ssdp

## 🏭 Constructors

### constructor

```ts
Ssdp(sourcePort: number, sockets: Socket[]): Ssdp
```
#### Parameters

- **sourcePort**: `number`
- **sockets**: `Socket[]`
#### Return Type

- `Ssdp`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L61" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:61</a>
</p>


## 🏷️ Properties

### multicast <Badge type="tip" text="readonly" />

```ts
multicast: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L56" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:56</a>
</p>


### port <Badge type="tip" text="readonly" />

```ts
port: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L57" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:57</a>
</p>


### sockets <Badge type="tip" text="readonly" />

```ts
sockets: Socket[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L63" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:63</a>
</p>


### sourcePort <Badge type="tip" text="readonly" />

```ts
sourcePort: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L62" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:62</a>
</p>


## 🔧 Methods

### destroy

```ts
destroy(): void
```
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L162" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:162</a>
</p>


### search

```ts
search(device: string): Promise<SsdpSearchResult>
```
#### Parameters

- **device**: `string`
#### Return Type

- `Promise<SsdpSearchResult>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/ssdp.ts#L94" target="_blank" rel="noreferrer">packages/nat-api/lib/ssdp.ts:94</a>
</p>


