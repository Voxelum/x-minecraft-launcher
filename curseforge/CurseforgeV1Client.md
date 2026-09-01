# Class CurseforgeV1Client

Reference the https://docs.curseforge.com/#curseforge-core-api-mods
## 🏭 Constructors

### constructor

```ts
CurseforgeV1Client(apiKey: string, options: CurseforgeClientOptions): CurseforgeV1Client
```
#### Parameters

- **apiKey**: `string`
- **options**: `CurseforgeClientOptions`
#### Return Type

- `CurseforgeV1Client`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L582" target="_blank" rel="noreferrer">packages/curseforge/index.ts:582</a>
</p>


## 🏷️ Properties

### headers

```ts
headers: Record<string, string>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L578" target="_blank" rel="noreferrer">packages/curseforge/index.ts:578</a>
</p>


## 🔧 Methods

### getCategories

```ts
getCategories(signal: AbortSignal): Promise<ModCategory[]>
```

#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<ModCategory[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L597" target="_blank" rel="noreferrer">packages/curseforge/index.ts:597</a>
</p>


### getFiles

```ts
getFiles(fileIds: number[], signal: AbortSignal): Promise<File[]>
```

#### Parameters

- **fileIds**: `number[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<File[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L725" target="_blank" rel="noreferrer">packages/curseforge/index.ts:725</a>
</p>


### getFingerprintsFuzzyMatchesByGameId

```ts
getFingerprintsFuzzyMatchesByGameId(gameId: number, fingerprints: number[], signal: AbortSignal): Promise<{ exactFingerprints: number[]; exactMatches: FingerprintMatch[]; isCacheBuilt: boolean; partialFingerprints: object; partialMatches: FingerprintMatch[]; unmatchedFingerprints: number[] } | { fuzzyMatches: FingerprintFuzzyMatch[] }>
```
#### Parameters

- **gameId**: `number`
- **fingerprints**: `number[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<{ exactFingerprints: number[]; exactMatches: FingerprintMatch[]; isCacheBuilt: boolean; partialFingerprints: object; partialMatches: FingerprintMatch[]; unmatchedFingerprints: number[] } | { fuzzyMatches: FingerprintFuzzyMatch[] }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L858" target="_blank" rel="noreferrer">packages/curseforge/index.ts:858</a>
</p>


### getFingerprintsMatchesByGameId

```ts
getFingerprintsMatchesByGameId(gameId: number, fingerprints: number[], signal: AbortSignal): Promise<{ exactFingerprints: number[]; exactMatches: FingerprintMatch[]; isCacheBuilt: boolean; partialFingerprints: object; partialMatches: FingerprintMatch[]; unmatchedFingerprints: number[] }>
```
#### Parameters

- **gameId**: `number`
- **fingerprints**: `number[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<{ exactFingerprints: number[]; exactMatches: FingerprintMatch[]; isCacheBuilt: boolean; partialFingerprints: object; partialMatches: FingerprintMatch[]; unmatchedFingerprints: number[] }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L814" target="_blank" rel="noreferrer">packages/curseforge/index.ts:814</a>
</p>


### getMod

```ts
getMod(modId: number, signal: AbortSignal): Promise<Mod>
```
Get the mod by mod Id.
#### Parameters

- **modId**: `number`
The id of mod
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Mod>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L620" target="_blank" rel="noreferrer">packages/curseforge/index.ts:620</a>
</p>


### getModDescription

```ts
getModDescription(modId: number, signal: AbortSignal): Promise<string>
```

#### Parameters

- **modId**: `number`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L639" target="_blank" rel="noreferrer">packages/curseforge/index.ts:639</a>
</p>


### getModFile

```ts
getModFile(modId: number, fileId: number, signal: AbortSignal): Promise<File>
```

#### Parameters

- **modId**: `number`
- **fileId**: `number`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<File>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L684" target="_blank" rel="noreferrer">packages/curseforge/index.ts:684</a>
</p>


### getModFileChangelog

```ts
getModFileChangelog(modId: number, fileId: number, signal: AbortSignal): Promise<string>
```
https://docs.curseforge.com/#get-mod-file-changelog
#### Parameters

- **modId**: `number`
- **fileId**: `number`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L798" target="_blank" rel="noreferrer">packages/curseforge/index.ts:798</a>
</p>


### getModFiles

```ts
getModFiles(options: GetModFilesOptions, signal: AbortSignal): Promise<{ data: File[]; pagination: Pagination }>
```

#### Parameters

- **options**: `GetModFilesOptions`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<{ data: File[]; pagination: Pagination }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L658" target="_blank" rel="noreferrer">packages/curseforge/index.ts:658</a>
</p>


### getMods

```ts
getMods(modIds: number[], signal: AbortSignal): Promise<Mod[]>
```

#### Parameters

- **modIds**: `number[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Mod[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L703" target="_blank" rel="noreferrer">packages/curseforge/index.ts:703</a>
</p>


### searchMods

```ts
searchMods(options: SearchOptions, signal: AbortSignal): Promise<{ data: Mod[]; pagination: Pagination }>
```

#### Parameters

- **options**: `SearchOptions`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<{ data: Mod[]; pagination: Pagination }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L747" target="_blank" rel="noreferrer">packages/curseforge/index.ts:747</a>
</p>


