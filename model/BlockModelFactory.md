# Class BlockModelFactory

## 🏭 Constructors

### constructor

```ts
BlockModelFactory(textureManager: TextureManager, option: { clipUVs?: boolean; modelOnly?: boolean }= {}): BlockModelFactory
```
#### Parameters

- **textureManager**: `TextureManager`
- **option**: `{ clipUVs?: boolean; modelOnly?: boolean }`
#### Return Type

- `BlockModelFactory`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/block.ts#L182" target="_blank" rel="noreferrer">packages/model/block.ts:182</a>
</p>


## 🏷️ Properties

### option <Badge type="tip" text="readonly" />

```ts
option: { clipUVs?: boolean; modelOnly?: boolean } = {}
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/block.ts#L184" target="_blank" rel="noreferrer">packages/model/block.ts:184</a>
</p>


### textureManager <Badge type="tip" text="readonly" />

```ts
textureManager: TextureManager
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/block.ts#L183" target="_blank" rel="noreferrer">packages/model/block.ts:183</a>
</p>


### TRANSPARENT_MATERIAL <Badge type="warning" text="static" />

```ts
TRANSPARENT_MATERIAL: MeshBasicMaterial = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/block.ts#L174" target="_blank" rel="noreferrer">packages/model/block.ts:174</a>
</p>


## 🔧 Methods

### getObject

```ts
getObject(model: Resolved, options: { uvlock?: boolean; x?: number; y?: number }= {}, fix: number= 0.001): BlockModelObject
```
Get threejs ``Object3D`` for that block model.
#### Parameters

- **model**: `Resolved`
- **options**: `{ uvlock?: boolean; x?: number; y?: number }`
- **fix**: `number`
#### Return Type

- `BlockModelObject`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/block.ts#L190" target="_blank" rel="noreferrer">packages/model/block.ts:190</a>
</p>


