# Class ResourceLocation

The Minecraft used object to map the game resource location.
## 🏭 Constructors

### constructor

```ts
ResourceLocation(domain: string, path: string): ResourceLocation
```
#### Parameters

- **domain**: `string`
- **path**: `string`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L90" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:90</a>
</p>


## 🏷️ Properties

### domain <Badge type="tip" text="readonly" />

```ts
domain: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L91" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:91</a>
</p>


### path <Badge type="tip" text="readonly" />

```ts
path: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L92" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:92</a>
</p>


## 🔧 Methods

### toString

```ts
toString(): string
```
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L95" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:95</a>
</p>


### deconstruct <Badge type="warning" text="static" />

```ts
deconstruct(path: string, appendPath: string= ''): ResourceLocation
```
#### Parameters

- **path**: `string`
- **appendPath**: `string`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L18" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:18</a>
</p>


### fromPath <Badge type="warning" text="static" />

```ts
fromPath(location: string | ResourceLocation): ResourceLocation
```
from absoluted path
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L79" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:79</a>
</p>


### getAssetsPath <Badge type="warning" text="static" />

```ts
getAssetsPath(location: string | ResourceLocation): string
```
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L83" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:83</a>
</p>


### ofBlockModelPath <Badge type="warning" text="static" />

```ts
ofBlockModelPath(location: string | ResourceLocation): ResourceLocation
```
build from model path
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L49" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:49</a>
</p>


### ofBlockStatePath <Badge type="warning" text="static" />

```ts
ofBlockStatePath(location: string | ResourceLocation): ResourceLocation
```
build from block state path
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L69" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:69</a>
</p>


### ofItemModelPath <Badge type="warning" text="static" />

```ts
ofItemModelPath(location: string | ResourceLocation): ResourceLocation
```
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L54" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:54</a>
</p>


### ofModelPath <Badge type="warning" text="static" />

```ts
ofModelPath(location: string | ResourceLocation): ResourceLocation
```
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L59" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:59</a>
</p>


### ofTexturePath <Badge type="warning" text="static" />

```ts
ofTexturePath(location: string | ResourceLocation): ResourceLocation
```
build from texture path
#### Parameters

- **location**: `string | ResourceLocation`
#### Return Type

- `ResourceLocation`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/resourcePack.ts#L39" target="_blank" rel="noreferrer">packages/resourcepack/resourcePack.ts:39</a>
</p>


