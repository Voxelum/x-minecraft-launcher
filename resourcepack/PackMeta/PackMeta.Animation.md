# Interface Animation

## 🏷️ Properties

### frames

```ts
frames: { index: number; time: number }[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L124" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:124</a>
</p>


### frametime

```ts
frametime: number
```
Sets the default time for each frame in increments of one game tick. Defaults to ``1``.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L123" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:123</a>
</p>


### height

```ts
height: number
```
The height of the tile in direct pixels, as a ratio rather than in pixels. This is unused in vanilla but can be used by mods to have frames that are not perfect squares.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L119" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:119</a>
</p>


### interpolate

```ts
interpolate: boolean
```
If true, Minecraft will generate additional frames between frames with a frame time greater than 1 between them. Defaults to false.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L111" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:111</a>
</p>


### width

```ts
width: number
```
The width of the tile, as a direct ratio rather than in pixels. This is unused in vanilla but can be used by mods to have frames that are not perfect squares.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L115" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:115</a>
</p>


