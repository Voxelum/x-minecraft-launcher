# Class FabricSemanticVersion

## 🏭 Constructors

### constructor

```ts
FabricSemanticVersion(version: string, storeX: boolean= false): FabricSemanticVersion
```
#### Parameters

- **version**: `string`
- **storeX**: `boolean`
#### Return Type

- `FabricSemanticVersion`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L27" target="_blank" rel="noreferrer">packages/semver/semver.ts:27</a>
</p>


## 🔧 Methods

### compareTo <Badge type="tip" text="public" />

```ts
compareTo(other: FabricComparableVersion): number
```
#### Parameters

- **other**: `FabricComparableVersion`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L192" target="_blank" rel="noreferrer">packages/semver/semver.ts:192</a>
</p>


### equals <Badge type="tip" text="public" />

```ts
equals(o: any): boolean
```
#### Parameters

- **o**: `any`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L162" target="_blank" rel="noreferrer">packages/semver/semver.ts:162</a>
</p>


### equalsComponentsExactly <Badge type="tip" text="public" />

```ts
equalsComponentsExactly(other: FabricSemanticVersion): boolean
```
#### Parameters

- **other**: `FabricSemanticVersion`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L182" target="_blank" rel="noreferrer">packages/semver/semver.ts:182</a>
</p>


### getBuildKey <Badge type="tip" text="public" />

```ts
getBuildKey(): string | undefined
```
#### Return Type

- `string | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L154" target="_blank" rel="noreferrer">packages/semver/semver.ts:154</a>
</p>


### getFriendlyString <Badge type="tip" text="public" />

```ts
getFriendlyString(): string
```
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L158" target="_blank" rel="noreferrer">packages/semver/semver.ts:158</a>
</p>


### getPrereleaseKey <Badge type="tip" text="public" />

```ts
getPrereleaseKey(): string | undefined
```
#### Return Type

- `string | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L150" target="_blank" rel="noreferrer">packages/semver/semver.ts:150</a>
</p>


### getVersionComponent <Badge type="tip" text="public" />

```ts
getVersionComponent(pos: number): number
```
#### Parameters

- **pos**: `number`
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L133" target="_blank" rel="noreferrer">packages/semver/semver.ts:133</a>
</p>


### getVersionComponentCount <Badge type="tip" text="public" />

```ts
getVersionComponentCount(): number
```
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L129" target="_blank" rel="noreferrer">packages/semver/semver.ts:129</a>
</p>


### getVersionComponents <Badge type="tip" text="public" />

```ts
getVersionComponents(): number[]
```
#### Return Type

- `number[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L146" target="_blank" rel="noreferrer">packages/semver/semver.ts:146</a>
</p>


### hasWildcard <Badge type="tip" text="public" />

```ts
hasWildcard(): boolean
```
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L178" target="_blank" rel="noreferrer">packages/semver/semver.ts:178</a>
</p>


### toString <Badge type="tip" text="public" />

```ts
toString(): string
```
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/semver/semver.ts#L174" target="_blank" rel="noreferrer">packages/semver/semver.ts:174</a>
</p>


