# Interface Blueprint

A normalized, in-memory representation of a blueprint, decoupled from any
particular on-disk format. All readers produce this; all writers consume it.
## 🏷️ Properties

### author <Badge type="info" text="optional" />

```ts
author: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L75" target="_blank" rel="noreferrer">packages/schematic/model.ts:75</a>
</p>


### blockEntities

```ts
blockEntities: BlueprintBlockEntity[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L91" target="_blank" rel="noreferrer">packages/schematic/model.ts:91</a>
</p>


### blocks

```ts
blocks: Uint16Array
```
Flattened palette indices. The block at ``(x, y, z)`` is stored at
``x + size.x * (z + size.z * y)``.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L90" target="_blank" rel="noreferrer">packages/schematic/model.ts:90</a>
</p>


### dataVersion <Badge type="info" text="optional" />

```ts
dataVersion: number
```
The Minecraft ``DataVersion`` the blueprint was created with, when known.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L80" target="_blank" rel="noreferrer">packages/schematic/model.ts:80</a>
</p>


### description <Badge type="info" text="optional" />

```ts
description: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L76" target="_blank" rel="noreferrer">packages/schematic/model.ts:76</a>
</p>


### entities

```ts
entities: BlueprintEntity[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L92" target="_blank" rel="noreferrer">packages/schematic/model.ts:92</a>
</p>


### format

```ts
format: BlueprintFormat
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L73" target="_blank" rel="noreferrer">packages/schematic/model.ts:73</a>
</p>


### name <Badge type="info" text="optional" />

```ts
name: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L74" target="_blank" rel="noreferrer">packages/schematic/model.ts:74</a>
</p>


### palette

```ts
palette: BlockState[]
```
Block state palette. Index ``0`` is conventionally ``minecraft:air``.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L85" target="_blank" rel="noreferrer">packages/schematic/model.ts:85</a>
</p>


### size

```ts
size: { x: number; y: number; z: number }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/schematic/model.ts#L81" target="_blank" rel="noreferrer">packages/schematic/model.ts:81</a>
</p>


