# Interface Element

## 🏷️ Properties

### faces <Badge type="info" text="optional" />

```ts
faces: { down?: Face; east?: Face; north?: Face; south?: Face; up?: Face; west?: Face }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L194" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:194</a>
</p>


### from

```ts
from: Vec3
```
Start point of a cube according to the scheme [x, y, z]. Values must be between -16 and 32.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L164" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:164</a>
</p>


### rotation <Badge type="info" text="optional" />

```ts
rotation: { angle: number; axis: "x" | "y" | "z"; origin: Vec3; rescale: boolean }
```
Defines the rotation of an element.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L172" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:172</a>
</p>


### shade <Badge type="info" text="optional" />

```ts
shade: boolean
```
Defines if shadows are rendered (true - default), not (false).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L193" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:193</a>
</p>


### to

```ts
to: Vec3
```
Stop point of a cube according to the scheme [x, y, z]. Values must be between -16 and 32.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/resourcepack/format.ts#L168" target="_blank" rel="noreferrer">packages/resourcepack/format.ts:168</a>
</p>


