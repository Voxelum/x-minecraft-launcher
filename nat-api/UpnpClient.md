# Class UpnpClient

## 🏭 Constructors

### constructor

```ts
UpnpClient(ssdp: Ssdp): UpnpClient
```
#### Parameters

- **ssdp**: `Ssdp`
#### Return Type

- `UpnpClient`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L74" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:74</a>
</p>


## 🏷️ Properties

### timeout <Badge type="tip" text="readonly" />

```ts
timeout: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L66" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:66</a>
</p>


## 🔧 Methods

### destroy

```ts
destroy(): void
```
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L272" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:272</a>
</p>


### externalIp

```ts
externalIp(): Promise<string>
```
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L204" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:204</a>
</p>


### findGateway

```ts
findGateway(): Promise<{ address: AddressInfo; device: Device }>
```
#### Return Type

- `Promise<{ address: AddressInfo; device: Device }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L223" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:223</a>
</p>


### getMappings

```ts
getMappings(options: GetMappingOptions= {}): Promise<MappingInfo[]>
```
#### Parameters

- **options**: `GetMappingOptions`
#### Return Type

- `Promise<MappingInfo[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L141" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:141</a>
</p>


### map

```ts
map(options: UpnpMapOptions): Promise<void>
```
#### Parameters

- **options**: `UpnpMapOptions`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L79" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:79</a>
</p>


### unmap

```ts
unmap(options: UpnpUnmapOptions): Promise<boolean>
```
#### Parameters

- **options**: `UpnpUnmapOptions`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nat-api/lib/upnp.ts#L111" target="_blank" rel="noreferrer">packages/nat-api/lib/upnp.ts:111</a>
</p>


