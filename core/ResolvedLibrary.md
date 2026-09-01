# Class ResolvedLibrary

A resolved library for launcher. It can by parsed from ``LibraryInfo``.
## 🏭 Constructors

### constructor

```ts
ResolvedLibrary(name: string, info: LibraryInfo, download: Artifact, isNative: boolean= false, checksums: string[], serverreq: boolean, clientreq: boolean, extractExclude: string[]): ResolvedLibrary
```
#### Parameters

- **name**: `string`
- **info**: `LibraryInfo`
- **download**: `Artifact`
- **isNative**: `boolean`
- **checksums**: `string[]`
- **serverreq**: `boolean`
- **clientreq**: `boolean`
- **extractExclude**: `string[]`
#### Return Type

- `ResolvedLibrary`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L262" target="_blank" rel="noreferrer">packages/core/version.ts:262</a>
</p>


## 🏷️ Properties

### artifactId <Badge type="tip" text="readonly" />

```ts
artifactId: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L256" target="_blank" rel="noreferrer">packages/core/version.ts:256</a>
</p>


### checksums <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
checksums: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L267" target="_blank" rel="noreferrer">packages/core/version.ts:267</a>
</p>


### classifier <Badge type="tip" text="readonly" />

```ts
classifier: string
```
The classifier. Normally, this is empty. For forge, it can be like ``universal``, ``installer``.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L260" target="_blank" rel="noreferrer">packages/core/version.ts:260</a>
</p>


### clientreq <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
clientreq: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L269" target="_blank" rel="noreferrer">packages/core/version.ts:269</a>
</p>


### download <Badge type="tip" text="readonly" />

```ts
download: Artifact
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L265" target="_blank" rel="noreferrer">packages/core/version.ts:265</a>
</p>


### extractExclude <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
extractExclude: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L270" target="_blank" rel="noreferrer">packages/core/version.ts:270</a>
</p>


### groupId <Badge type="tip" text="readonly" />

```ts
groupId: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L255" target="_blank" rel="noreferrer">packages/core/version.ts:255</a>
</p>


### isNative <Badge type="tip" text="readonly" />

```ts
isNative: boolean = false
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L266" target="_blank" rel="noreferrer">packages/core/version.ts:266</a>
</p>


### isSnapshot <Badge type="tip" text="readonly" />

```ts
isSnapshot: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L258" target="_blank" rel="noreferrer">packages/core/version.ts:258</a>
</p>


### name <Badge type="tip" text="readonly" />

```ts
name: string
```
The original maven name of this library
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L263" target="_blank" rel="noreferrer">packages/core/version.ts:263</a>
</p>


### path <Badge type="tip" text="readonly" />

```ts
path: string
```
The maven path.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L261" target="_blank" rel="noreferrer">packages/core/version.ts:261</a>
</p>


### serverreq <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
serverreq: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L268" target="_blank" rel="noreferrer">packages/core/version.ts:268</a>
</p>


### type <Badge type="tip" text="readonly" />

```ts
type: string
```
The file extension. Default is ``jar``. Some files in forge are ``zip``.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L259" target="_blank" rel="noreferrer">packages/core/version.ts:259</a>
</p>


### version <Badge type="tip" text="readonly" />

```ts
version: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L257" target="_blank" rel="noreferrer">packages/core/version.ts:257</a>
</p>


