# Class PlayerModel

## 🏭 Constructors

### constructor

```ts
PlayerModel(): PlayerModel
```
#### Return Type

- `PlayerModel`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L264" target="_blank" rel="noreferrer">packages/model/player.ts:264</a>
</p>


## 🏷️ Properties

### materialCape <Badge type="tip" text="readonly" />

```ts
materialCape: MeshBasicMaterial
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L260" target="_blank" rel="noreferrer">packages/model/player.ts:260</a>
</p>


### materialPlayer <Badge type="tip" text="readonly" />

```ts
materialPlayer: MeshBasicMaterial
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L258" target="_blank" rel="noreferrer">packages/model/player.ts:258</a>
</p>


### materialTransparent <Badge type="tip" text="readonly" />

```ts
materialTransparent: MeshBasicMaterial
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L259" target="_blank" rel="noreferrer">packages/model/player.ts:259</a>
</p>


### playerObject3d <Badge type="tip" text="readonly" />

```ts
playerObject3d: PlayerObject3D
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L257" target="_blank" rel="noreferrer">packages/model/player.ts:257</a>
</p>


### textureCape <Badge type="tip" text="readonly" />

```ts
textureCape: CanvasTexture
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L261" target="_blank" rel="noreferrer">packages/model/player.ts:261</a>
</p>


### texturePlayer <Badge type="tip" text="readonly" />

```ts
texturePlayer: CanvasTexture
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L262" target="_blank" rel="noreferrer">packages/model/player.ts:262</a>
</p>


## 🔧 Methods

### setCape

```ts
setCape(cape: TextureSource | undefined): Promise<void>
```
#### Parameters

- **cape**: `TextureSource | undefined`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L327" target="_blank" rel="noreferrer">packages/model/player.ts:327</a>
</p>


### setSkin

```ts
setSkin(skin: TextureSource, isSlim: boolean= false): Promise<void>
```

#### Parameters

- **skin**: `TextureSource`
The skin texture source. Should be url string, URL object, or a Image HTML element
- **isSlim**: `boolean`
Is this skin slim
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L308" target="_blank" rel="noreferrer">packages/model/player.ts:308</a>
</p>


### create <Badge type="warning" text="static" />

```ts
create(): PlayerModel
```
#### Return Type

- `PlayerModel`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/model/player.ts#L253" target="_blank" rel="noreferrer">packages/model/player.ts:253</a>
</p>


