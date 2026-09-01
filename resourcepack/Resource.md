# Interface Resource

The resource in the resource pack on a ``ResourceLocation``
## 🏷️ Properties

### location <Badge type="tip" text="readonly" />

```ts
location: ResourceLocation
```
The absolute location of the resource
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L108" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:108</a>
</p>


### url <Badge type="tip" text="readonly" />

```ts
url: string
```
The real resource url which is used for reading the content of it.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L112" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:112</a>
</p>


## 🔧 Methods

### read

```ts
read(): Promise<Uint8Array<ArrayBufferLike>>
```
Read the resource content
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

```ts
read(encoding: undefined): Promise<Uint8Array<ArrayBufferLike>>
```
#### Parameters

- **encoding**: `undefined`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

```ts
read(encoding: "base64" | "utf-8"): Promise<string>
```
#### Parameters

- **encoding**: `"base64" | "utf-8"`
#### Return Type

- `Promise<string>`

```ts
read(encoding: "base64" | "utf-8"): Promise<string | Uint8Array<ArrayBufferLike>>
```
#### Parameters

- **encoding**: `"base64" | "utf-8"`
#### Return Type

- `Promise<string | Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L116" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:116</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L117" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:117</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L118" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:118</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L119" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:119</a>
</p>


### readMetadata

```ts
readMetadata(): Promise<PackMeta>
```
Read the metadata of the resource
#### Return Type

- `Promise<PackMeta>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L123" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:123</a>
</p>


