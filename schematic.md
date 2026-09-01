## 🤝 Interfaces

<div class="definition-grid interface"><a href="schematic/BlockReplacement">BlockReplacement</a><a href="schematic/BlockState">BlockState</a><a href="schematic/Blueprint">Blueprint</a><a href="schematic/BlueprintBlockEntity">BlueprintBlockEntity</a><a href="schematic/BlueprintEntity">BlueprintEntity</a><a href="schematic/MaterialEntry">MaterialEntry</a></div>

## 🏳️ Enums

<div class="definition-grid enum"><a href="schematic/BlueprintFormat">BlueprintFormat</a><a href="schematic/ReplaceMode">ReplaceMode</a></div>

## 🏭 Functions

### blockIndex

```ts
blockIndex(size: { x: number; y: number; z: number }, x: number, y: number, z: number): number
```
#### Parameters

- **size**: `{ x: number; y: number; z: number }`
- **x**: `number`
- **y**: `number`
- **z**: `number`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L95" target="_blank" rel="noreferrer">packages/schematic/model.ts:95</a>
</p>


### blockStateEquals

```ts
blockStateEquals(a: BlockState, b: BlockState): boolean
```
#### Parameters

- **a**: `BlockState`
- **b**: `BlockState`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L141" target="_blank" rel="noreferrer">packages/schematic/model.ts:141</a>
</p>


### convertBlueprint

```ts
convertBlueprint(data: Uint8Array, fileName: string, target: BlueprintFormat): Promise<{ data: Uint8Array; extension: string }>
```
Read a blueprint file and re-encode it into the target format.
#### Parameters

- **data**: `Uint8Array`
- **fileName**: `string`
- **target**: `BlueprintFormat`
#### Return Type

- `Promise<{ data: Uint8Array; extension: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/convert.ts#L48" target="_blank" rel="noreferrer">packages/schematic/convert.ts:48</a>
</p>


### detectFormat

```ts
detectFormat(fileName: string): BlueprintFormat | undefined
```
Detect the [BlueprintFormat](BlueprintFormat) of a file from its name.
#### Parameters

- **fileName**: `string`
#### Return Type

- `BlueprintFormat | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/read.ts#L10" target="_blank" rel="noreferrer">packages/schematic/read.ts:10</a>
</p>


### extensionForFormat

```ts
extensionForFormat(format: BlueprintFormat): string
```
The file extension that should be used for a given format.
#### Parameters

- **format**: `BlueprintFormat`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/convert.ts#L29" target="_blank" rel="noreferrer">packages/schematic/convert.ts:29</a>
</p>


### getBlockCount

```ts
getBlockCount(blueprint: Blueprint): number
```
The total number of non-air blocks.
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/material.ts#L32" target="_blank" rel="noreferrer">packages/schematic/material.ts:32</a>
</p>


### getMaterialList

```ts
getMaterialList(blueprint: Blueprint): MaterialEntry[]
```
Compute the material list (block id -&gt; count) for a blueprint, sorted by
descending count.
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `MaterialEntry[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/material.ts#L15" target="_blank" rel="noreferrer">packages/schematic/material.ts:15</a>
</p>


### getUsedBlocks

```ts
getUsedBlocks(blueprint: Blueprint): string[]
```
The distinct block ids used in the blueprint (excluding air).
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `string[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/replace.ts#L71" target="_blank" rel="noreferrer">packages/schematic/replace.ts:71</a>
</p>


### getVolume

```ts
getVolume(blueprint: Blueprint): number
```
The bounding volume of the blueprint.
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/material.ts#L44" target="_blank" rel="noreferrer">packages/schematic/material.ts:44</a>
</p>


### isAir

```ts
isAir(state: BlockState | undefined): boolean
```
#### Parameters

- **state**: `BlockState | undefined`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L101" target="_blank" rel="noreferrer">packages/schematic/model.ts:101</a>
</p>


### isBlueprintFile

```ts
isBlueprintFile(fileName: string): boolean
```
#### Parameters

- **fileName**: `string`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/read.ts#L17" target="_blank" rel="noreferrer">packages/schematic/read.ts:17</a>
</p>


### parseBlockState

```ts
parseBlockState(input: string): BlockState
```
Parse a block state string like ``minecraft:chest[facing=north,type=single]``
into a [BlockState](BlockState).
#### Parameters

- **input**: `string`
#### Return Type

- `BlockState`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L109" target="_blank" rel="noreferrer">packages/schematic/model.ts:109</a>
</p>


### readBlueprint

```ts
readBlueprint(data: Uint8Array, fileName: string): Promise<Blueprint>
```
Read any supported blueprint file into the normalized [Blueprint](Blueprint) model.
#### Parameters

- **data**: `Uint8Array`
- **fileName**: `string`
#### Return Type

- `Promise<Blueprint>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/read.ts#L24" target="_blank" rel="noreferrer">packages/schematic/read.ts:24</a>
</p>


### readBuildingGadget

```ts
readBuildingGadget(data: Uint8Array): Blueprint
```
Read a Building Gadgets (建筑小帮手) template ``.json``.

Supports both the clean shape produced by [writeBuildingGadget](#writeBuildingGadget) and the
native Building Gadgets ``statePosArrayList`` / ``mapIntState`` export.
#### Parameters

- **data**: `Uint8Array`
#### Return Type

- `Blueprint`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/buildingGadget.ts#L18" target="_blank" rel="noreferrer">packages/schematic/formats/buildingGadget.ts:18</a>
</p>


### readLitematic

```ts
readLitematic(data: Uint8Array): Promise<Blueprint>
```
Read a Litematica schematic (``.litematic``). Multiple regions are merged into a
single combined grid.
#### Parameters

- **data**: `Uint8Array`
#### Return Type

- `Promise<Blueprint>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/litematica.ts#L19" target="_blank" rel="noreferrer">packages/schematic/formats/litematica.ts:19</a>
</p>


### readSponge

```ts
readSponge(data: Uint8Array): Promise<Blueprint>
```
Read a Sponge schematic (``.schem``). Supports schematic versions 1-3.
#### Parameters

- **data**: `Uint8Array`
#### Return Type

- `Promise<Blueprint>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/sponge.ts#L9" target="_blank" rel="noreferrer">packages/schematic/formats/sponge.ts:9</a>
</p>


### readStructure

```ts
readStructure(data: Uint8Array): Promise<Blueprint>
```
Read a vanilla structure block file (``.nbt``).
#### Parameters

- **data**: `Uint8Array`
#### Return Type

- `Promise<Blueprint>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/structure.ts#L9" target="_blank" rel="noreferrer">packages/schematic/formats/structure.ts:9</a>
</p>


### replaceBlocks

```ts
replaceBlocks(blueprint: Blueprint, replacements: BlockReplacement[], mode: ReplaceMode= ReplaceMode.Simple): number
```
Replace blocks in a blueprint in place. Returns the number of block cells
affected.
#### Parameters

- **blueprint**: `Blueprint`
- **replacements**: `BlockReplacement[]`
- **mode**: `ReplaceMode`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/replace.ts#L28" target="_blank" rel="noreferrer">packages/schematic/replace.ts:28</a>
</p>


### stringifyBlockState

```ts
stringifyBlockState(state: BlockState): string
```
Convert a [BlockState](BlockState) back to a string like
``minecraft:chest[facing=north,type=single]``.
#### Parameters

- **state**: `BlockState`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L129" target="_blank" rel="noreferrer">packages/schematic/model.ts:129</a>
</p>


### writeBlueprint

```ts
writeBlueprint(blueprint: Blueprint, format: BlueprintFormat): Promise<Uint8Array<ArrayBufferLike>>
```
Serialize a [Blueprint](Blueprint) into the given format.
#### Parameters

- **blueprint**: `Blueprint`
- **format**: `BlueprintFormat`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/convert.ts#L11" target="_blank" rel="noreferrer">packages/schematic/convert.ts:11</a>
</p>


### writeBuildingGadget

```ts
writeBuildingGadget(blueprint: Blueprint): Uint8Array
```
Write a Building Gadgets template ``.json`` in the clean shape.
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `Uint8Array`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/buildingGadget.ts#L124" target="_blank" rel="noreferrer">packages/schematic/formats/buildingGadget.ts:124</a>
</p>


### writeLitematic

```ts
writeLitematic(blueprint: Blueprint): Promise<Uint8Array<ArrayBufferLike>>
```
Write a Litematica schematic (``.litematic``) with a single region.
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/litematica.ts#L138" target="_blank" rel="noreferrer">packages/schematic/formats/litematica.ts:138</a>
</p>


### writeSponge

```ts
writeSponge(blueprint: Blueprint): Promise<Uint8Array<ArrayBufferLike>>
```
Write a Sponge schematic version 2 (``.schem``).
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/sponge.ts#L78" target="_blank" rel="noreferrer">packages/schematic/formats/sponge.ts:78</a>
</p>


### writeStructure

```ts
writeStructure(blueprint: Blueprint): Promise<Uint8Array<ArrayBufferLike>>
```
Write a vanilla structure block file (``.nbt``).
#### Parameters

- **blueprint**: `Blueprint`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/formats/structure.ts#L60" target="_blank" rel="noreferrer">packages/schematic/formats/structure.ts:60</a>
</p>



## 🏷️ Variables

### BLUEPRINT_EXTENSIONS <Badge type="tip" text="const" />

```ts
BLUEPRINT_EXTENSIONS: Record<string, BlueprintFormat> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L27" target="_blank" rel="noreferrer">packages/schematic/model.ts:27</a>
</p>



