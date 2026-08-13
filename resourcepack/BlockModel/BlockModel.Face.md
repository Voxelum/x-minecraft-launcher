# Interface Face

## 🏷️ Properties

### cullface <Badge type="info" text="optional" />

```ts
cullface: Direction
```
Specifies whether a face does not need to be rendered when there is a block touching it in the specified position.
The position can be: down, up, north, south, west, or east. It will also determine which side of the block to use the light level from for lighting the face,
and if unset, defaults to the side.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L221" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:221</a>
</p>


### rotation <Badge type="info" text="optional" />

```ts
rotation: 0 | 90 | 180 | 270
```
Rotates the texture by the specified number of degrees.
Can be 0, 90, 180, or 270. Defaults to 0. Rotation does not affect which part of the texture is used.
Instead, it amounts to permutation of the selected texture vertexes (selected implicitly, or explicitly though uv).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L228" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:228</a>
</p>


### texture

```ts
texture: string
```
Specifies the texture in form of the texture variable prepended with a #.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L215" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:215</a>
</p>


### tintindex <Badge type="info" text="optional" />

```ts
tintindex: number
```
Determines whether to tint the texture using a hardcoded tint index. The default is not using the tint, and any number causes it to use tint. Note that only certain blocks have a tint index, all others will be unaffected.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L232" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:232</a>
</p>


### uv <Badge type="info" text="optional" />

```ts
uv: Vec4
```
Defines the area of the texture to use according to the scheme [x1, y1, x2, y2].
If unset, it defaults to values equal to xyz position of the element.
The texture behavior will be inconsistent if UV extends below 0 or above 16.
If the numbers of x1 and x2 are swapped (e.g. from 0, 0, 16, 16 to 16, 0, 0, 16), the texture will be flipped. UV is optional, and if not supplied it will automatically generate based on the element's position.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L210" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:210</a>
</p>


