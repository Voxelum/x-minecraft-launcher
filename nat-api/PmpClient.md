# Class PmpClient

## 🏭 Constructors

### constructor

```ts
PmpClient(gateway: string, socket: Socket): PmpClient
```
#### Parameters

- **gateway**: `string`
- **socket**: `Socket`
#### Return Type

- `PmpClient`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L56" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:56</a>
</p>


## 🏷️ Properties

### gateway <Badge type="tip" text="readonly" />

```ts
gateway: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L57" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:57</a>
</p>


### socket <Badge type="tip" text="readonly" />

```ts
socket: Socket
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L58" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:58</a>
</p>


## 🔧 Methods

### close

```ts
close(): void
```
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L90" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:90</a>
</p>


### externalIp

```ts
externalIp(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L85" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:85</a>
</p>


### map

```ts
map(opts: PmpMapOptions): Promise<void>
```
#### Parameters

- **opts**: `PmpMapOptions`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L63" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:63</a>
</p>


### unmap

```ts
unmap(opts: PmpMapOptions): Promise<void>
```
#### Parameters

- **opts**: `PmpMapOptions`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/pmp.ts#L79" target="_blank" rel="noreferrer">packages/nat-api/lib/pmp.ts:79</a>
</p>


