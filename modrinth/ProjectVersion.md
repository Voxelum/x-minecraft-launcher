# Interface ProjectVersion

## 🏷️ Properties

### author_id

```ts
author_id: string
```
The ID of the author who published this version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L195" target="_blank" rel="noreferrer">packages/modrinth/types.ts:195</a>
</p>


### changelog <Badge type="info" text="optional" />

```ts
changelog: string
```
The changelog for this version of the mod.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L211" target="_blank" rel="noreferrer">packages/modrinth/types.ts:211</a>
</p>


### changelog_url <Badge type="info" text="optional" />

```ts
changelog_url: string
```
DEPRECATED A link to the changelog for this version of the mod
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L215" target="_blank" rel="noreferrer">packages/modrinth/types.ts:215</a>
</p>


### date_published

```ts
date_published: string
```
The date that this version was published
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L219" target="_blank" rel="noreferrer">packages/modrinth/types.ts:219</a>
</p>


### dependencies

```ts
dependencies: { dependency_type: "required" | "optional" | "incompatible" | "embedded"; project_id: string; version_id: string | null }[]
```
A list of specific versions of mods that this version depends on
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L235" target="_blank" rel="noreferrer">packages/modrinth/types.ts:235</a>
</p>


### downloads

```ts
downloads: number
```
The number of downloads this specific version has
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L223" target="_blank" rel="noreferrer">packages/modrinth/types.ts:223</a>
</p>


### featured

```ts
featured: boolean
```
Whether the version is featured or not
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L199" target="_blank" rel="noreferrer">packages/modrinth/types.ts:199</a>
</p>


### files

```ts
files: ModVersionFile[]
```
A list of files available for download for this version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L231" target="_blank" rel="noreferrer">packages/modrinth/types.ts:231</a>
</p>


### game_versions

```ts
game_versions: string[]
```
A list of versions of Minecraft that this version of the mod supports
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L243" target="_blank" rel="noreferrer">packages/modrinth/types.ts:243</a>
</p>


### id

```ts
id: string
```
The ID of the version, encoded as a base62 string
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L187" target="_blank" rel="noreferrer">packages/modrinth/types.ts:187</a>
</p>


### loaders

```ts
loaders: string[]
```
The mod loaders that this version supports
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L247" target="_blank" rel="noreferrer">packages/modrinth/types.ts:247</a>
</p>


### name

```ts
name: string
```
The name of this version
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L203" target="_blank" rel="noreferrer">packages/modrinth/types.ts:203</a>
</p>


### project_id

```ts
project_id: string
```
The ID of the project this version is for
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L191" target="_blank" rel="noreferrer">packages/modrinth/types.ts:191</a>
</p>


### version_number

```ts
version_number: string
```
The version number. Ideally will follow semantic versioning
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L207" target="_blank" rel="noreferrer">packages/modrinth/types.ts:207</a>
</p>


### version_type

```ts
version_type: string
```
The type of the release - alpha, beta, or release
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/types.ts#L227" target="_blank" rel="noreferrer">packages/modrinth/types.ts:227</a>
</p>


