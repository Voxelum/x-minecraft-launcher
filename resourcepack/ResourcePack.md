# Class ResourcePack

The Minecraft resource pack. Providing the loading resource from ``ResourceLocation`` function.
It's a wrap of ``FileSystem`` which provides cross node/browser accssing.
## 🏭 Constructors

### constructor

```ts
ResourcePack(fs: FileSystem): ResourcePack
```
#### Parameters

- **fs**: `FileSystem`
#### Return Type

- `ResourcePack`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L134" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:134</a>
</p>


## 🏷️ Properties

### fs <Badge type="tip" text="readonly" />

```ts
fs: FileSystem
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L134" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:134</a>
</p>


## 🔧 Methods

### domains

```ts
domains(): Promise<string[]>
```
The owned domain. You can think about the modids.
#### Return Type

- `Promise<string[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L202" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:202</a>
</p>


### get

```ts
get(location: ResourceLocation): Promise<Resource | undefined>
```
Get the resource on the resource location.

It can be undefined if there is no resource at that location.
#### Parameters

- **location**: `ResourceLocation`
THe resource location
#### Return Type

- `Promise<Resource | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L181" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:181</a>
</p>


### getUrl

```ts
getUrl(location: ResourceLocation): string
```
Get the url of the resource location.
Please notice that this is depended on ``FileSystem`` implementation of the ``getUrl``.
#### Parameters

- **location**: `ResourceLocation`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L170" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:170</a>
</p>


### has

```ts
has(location: ResourceLocation): Promise<boolean>
```
Does the resource pack has the resource
#### Parameters

- **location**: `ResourceLocation`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L195" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:195</a>
</p>


### icon

```ts
icon(): Promise<Uint8Array<ArrayBufferLike>>
```
The icon of the resource pack
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L232" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:232</a>
</p>


### info

```ts
info(): Promise<Pack>
```
The pack info, just like resource pack
#### Return Type

- `Promise<Pack>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L216" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:216</a>
</p>


### load

```ts
load(location: ResourceLocation, type: "base64" | "utf-8"): Promise<string | Uint8Array<ArrayBufferLike> | undefined>
```
Load the resource content
#### Parameters

- **location**: `ResourceLocation`
The resource location
- **type**: `"base64" | "utf-8"`
The output type of the resource
#### Return Type

- `Promise<string | Uint8Array<ArrayBufferLike> | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L140" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:140</a>
</p>


### loadMetadata

```ts
loadMetadata(location: ResourceLocation): Promise<any>
```
Load the resource metadata which is localted at &lt;resource-path&gt;.mcmeta
#### Parameters

- **location**: `ResourceLocation`
#### Return Type

- `Promise<any>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L154" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:154</a>
</p>


### open <Badge type="warning" text="static" />

```ts
open(resourcePack: string | Uint8Array<ArrayBufferLike> | FileSystem): Promise<ResourcePack>
```
#### Parameters

- **resourcePack**: `string | Uint8Array<ArrayBufferLike> | FileSystem`
#### Return Type

- `Promise<ResourcePack>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L240" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:240</a>
</p>


