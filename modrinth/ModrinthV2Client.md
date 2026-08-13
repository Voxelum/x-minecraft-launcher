# Class ModrinthV2Client


## 🏭 Constructors

### constructor

```ts
ModrinthV2Client(options: ModrinthClientOptions): ModrinthV2Client
```
#### Parameters

- **options**: `ModrinthClientOptions`
#### Return Type

- `ModrinthV2Client`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L272" target="_blank" rel="noreferrer">packages/modrinth/index.ts:272</a>
</p>


## 🏷️ Properties

### headers

```ts
headers: Record<string, string>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L270" target="_blank" rel="noreferrer">packages/modrinth/index.ts:270</a>
</p>


## 🔧 Methods

### addProjectGalleryImage

```ts
addProjectGalleryImage(projectId: string, image: Blob, extension: string, data: ModrinthGalleryImageData, signal: AbortSignal): Promise<void>
```
#### Parameters

- **projectId**: `string`
- **image**: `Blob`
- **extension**: `string`
- **data**: `ModrinthGalleryImageData`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L395" target="_blank" rel="noreferrer">packages/modrinth/index.ts:395</a>
</p>


### createCollection

```ts
createCollection(name: string, description: string, projectIds: string[], signal: AbortSignal): Promise<Collection>
```
#### Parameters

- **name**: `string`
- **description**: `string`
- **projectIds**: `string[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Collection>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L761" target="_blank" rel="noreferrer">packages/modrinth/index.ts:761</a>
</p>


### createProject

```ts
createProject(data: CreateModrinthProjectData, icon: { data: Blob; fileName: string }, signal: AbortSignal): Promise<Project>
```
#### Parameters

- **data**: `CreateModrinthProjectData`
- **icon**: `{ data: Blob; fileName: string }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Project>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L338" target="_blank" rel="noreferrer">packages/modrinth/index.ts:338</a>
</p>


### createVersion

```ts
createVersion(data: CreateModrinthVersionData, files: ModrinthUploadFile[], primaryFile: string, signal: AbortSignal): Promise<ProjectVersion>
```
#### Parameters

- **data**: `CreateModrinthVersionData`
- **files**: `ModrinthUploadFile[]`
- **primaryFile**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<ProjectVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L475" target="_blank" rel="noreferrer">packages/modrinth/index.ts:475</a>
</p>


### deleteProjectGalleryImage

```ts
deleteProjectGalleryImage(projectId: string, imageUrl: string, signal: AbortSignal): Promise<void>
```
#### Parameters

- **projectId**: `string`
- **imageUrl**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L419" target="_blank" rel="noreferrer">packages/modrinth/index.ts:419</a>
</p>


### followProject

```ts
followProject(id: string, signal: AbortSignal): Promise<void>
```

#### Parameters

- **id**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L823" target="_blank" rel="noreferrer">packages/modrinth/index.ts:823</a>
</p>


### getAuthenticatedUser

```ts
getAuthenticatedUser(signal: AbortSignal): Promise<User>
```
#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<User>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L808" target="_blank" rel="noreferrer">packages/modrinth/index.ts:808</a>
</p>


### getCategoryTags

```ts
getCategoryTags(signal: AbortSignal): Promise<Category[]>
```

#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<Category[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L681" target="_blank" rel="noreferrer">packages/modrinth/index.ts:681</a>
</p>


### getCollections

```ts
getCollections(userId: string, signal: AbortSignal): Promise<Collection[]>
```
#### Parameters

- **userId**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Collection[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L726" target="_blank" rel="noreferrer">packages/modrinth/index.ts:726</a>
</p>


### getGameVersionTags

```ts
getGameVersionTags(signal: AbortSignal): Promise<GameVersion[]>
```

#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<GameVersion[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L697" target="_blank" rel="noreferrer">packages/modrinth/index.ts:697</a>
</p>


### getLatestProjectVersion

```ts
getLatestProjectVersion(sha1: string, __namedParameters: { algorithm?: string; gameVersions?: string[]; loaders?: string[] }= {}, signal: AbortSignal): Promise<ProjectVersion>
```

#### Parameters

- **sha1**: `string`
- **__namedParameters**: `{ algorithm?: string; gameVersions?: string[]; loaders?: string[] }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<ProjectVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L635" target="_blank" rel="noreferrer">packages/modrinth/index.ts:635</a>
</p>


### getLatestVersionsFromHashes

```ts
getLatestVersionsFromHashes(hashes: string[], __namedParameters: { algorithm?: string; gameVersions?: string[]; loaders?: string[] }= {}, signal: AbortSignal): Promise<Record<string, ProjectVersion>>
```

#### Parameters

- **hashes**: `string[]`
- **__namedParameters**: `{ algorithm?: string; gameVersions?: string[]; loaders?: string[] }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Record<string, ProjectVersion>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L604" target="_blank" rel="noreferrer">packages/modrinth/index.ts:604</a>
</p>


### getLicenseTags

```ts
getLicenseTags(signal: AbortSignal): Promise<License[]>
```

#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<License[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L665" target="_blank" rel="noreferrer">packages/modrinth/index.ts:665</a>
</p>


### getLoaderTags

```ts
getLoaderTags(signal: AbortSignal): Promise<Loader[]>
```

#### Parameters

- **signal**: `AbortSignal`
#### Return Type

- `Promise<Loader[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L713" target="_blank" rel="noreferrer">packages/modrinth/index.ts:713</a>
</p>


### getProject

```ts
getProject(projectId: string, signal: AbortSignal): Promise<Project>
```

#### Parameters

- **projectId**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Project>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L305" target="_blank" rel="noreferrer">packages/modrinth/index.ts:305</a>
</p>


### getProjects

```ts
getProjects(projectIds: string[], signal: AbortSignal): Promise<Project[]>
```

#### Parameters

- **projectIds**: `string[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Project[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L324" target="_blank" rel="noreferrer">packages/modrinth/index.ts:324</a>
</p>


### getProjectTeamMembers

```ts
getProjectTeamMembers(projectId: string, signal: AbortSignal): Promise<TeamMember[]>
```

#### Parameters

- **projectId**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<TeamMember[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L869" target="_blank" rel="noreferrer">packages/modrinth/index.ts:869</a>
</p>


### getProjectVersion

```ts
getProjectVersion(versionId: string, signal: AbortSignal): Promise<ProjectVersion>
```

#### Parameters

- **versionId**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<ProjectVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L462" target="_blank" rel="noreferrer">packages/modrinth/index.ts:462</a>
</p>


### getProjectVersionByHash

```ts
getProjectVersionByHash(hash: string, __namedParameters: { algorithm?: string; multiple?: boolean }= {}, signal: AbortSignal): Promise<ProjectVersion>
```

#### Parameters

- **hash**: `string`
- **__namedParameters**: `{ algorithm?: string; multiple?: boolean }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<ProjectVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L582" target="_blank" rel="noreferrer">packages/modrinth/index.ts:582</a>
</p>


### getProjectVersions

```ts
getProjectVersions(projectId: string, __namedParameters: { featured?: boolean; gameVersions?: string[]; loaders?: string[] }= {}, signal: AbortSignal): Promise<ProjectVersion[]>
```

#### Parameters

- **projectId**: `string`
- **__namedParameters**: `{ featured?: boolean; gameVersions?: string[]; loaders?: string[] }`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<ProjectVersion[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L429" target="_blank" rel="noreferrer">packages/modrinth/index.ts:429</a>
</p>


### getProjectVersionsByHash

```ts
getProjectVersionsByHash(hashes: string[], algorithm: string= 'sha1', signal: AbortSignal): Promise<Record<string, ProjectVersion>>
```

#### Parameters

- **hashes**: `string[]`
- **algorithm**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Record<string, ProjectVersion>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L558" target="_blank" rel="noreferrer">packages/modrinth/index.ts:558</a>
</p>


### getProjectVersionsById

```ts
getProjectVersionsById(ids: string[], signal: AbortSignal): Promise<ProjectVersion[]>
```

#### Parameters

- **ids**: `string[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<ProjectVersion[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L530" target="_blank" rel="noreferrer">packages/modrinth/index.ts:530</a>
</p>


### getUser

```ts
getUser(id: string, signal: AbortSignal): Promise<User>
```

#### Parameters

- **id**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<User>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L885" target="_blank" rel="noreferrer">packages/modrinth/index.ts:885</a>
</p>


### getUserFollowedProjects

```ts
getUserFollowedProjects(userId: string, signal: AbortSignal): Promise<Project[]>
```

#### Parameters

- **userId**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Project[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L853" target="_blank" rel="noreferrer">packages/modrinth/index.ts:853</a>
</p>


### getUserProjects

```ts
getUserProjects(id: string, signal: AbortSignal): Promise<Project[]>
```

#### Parameters

- **id**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<Project[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L901" target="_blank" rel="noreferrer">packages/modrinth/index.ts:901</a>
</p>


### searchProjects

```ts
searchProjects(options: SearchProjectOptions, signal: AbortSignal): Promise<SearchResult>
```

#### Parameters

- **options**: `SearchProjectOptions`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<SearchResult>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L281" target="_blank" rel="noreferrer">packages/modrinth/index.ts:281</a>
</p>


### unfollowProject

```ts
unfollowProject(id: string, signal: AbortSignal): Promise<void>
```

#### Parameters

- **id**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L838" target="_blank" rel="noreferrer">packages/modrinth/index.ts:838</a>
</p>


### updateCollection

```ts
updateCollection(collectionId: string, projectIds: string[], signal: AbortSignal): Promise<void>
```
#### Parameters

- **collectionId**: `string`
- **projectIds**: `string[]`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L792" target="_blank" rel="noreferrer">packages/modrinth/index.ts:792</a>
</p>


### updateProject

```ts
updateProject(projectId: string, data: UpdateModrinthProjectData, signal: AbortSignal): Promise<void>
```
#### Parameters

- **projectId**: `string`
- **data**: `UpdateModrinthProjectData`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L368" target="_blank" rel="noreferrer">packages/modrinth/index.ts:368</a>
</p>


### updateProjectGalleryImage

```ts
updateProjectGalleryImage(projectId: string, imageUrl: string, data: Partial<ModrinthGalleryImageData>, signal: AbortSignal): Promise<void>
```
#### Parameters

- **projectId**: `string`
- **imageUrl**: `string`
- **data**: `Partial<ModrinthGalleryImageData>`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L408" target="_blank" rel="noreferrer">packages/modrinth/index.ts:408</a>
</p>


### updateProjectIcon

```ts
updateProjectIcon(projectId: string, icon: Blob, extension: string, signal: AbortSignal): Promise<void>
```
#### Parameters

- **projectId**: `string`
- **icon**: `Blob`
- **extension**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L381" target="_blank" rel="noreferrer">packages/modrinth/index.ts:381</a>
</p>


### updateVersion

```ts
updateVersion(versionId: string, data: UpdateModrinthVersionData, signal: AbortSignal): Promise<void>
```
#### Parameters

- **versionId**: `string`
- **data**: `UpdateModrinthVersionData`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L514" target="_blank" rel="noreferrer">packages/modrinth/index.ts:514</a>
</p>


### uppdateCollectionIcon

```ts
uppdateCollectionIcon(collectionId: string, iconData: ArrayBuffer, mimeType: string, signal: AbortSignal): Promise<void>
```
#### Parameters

- **collectionId**: `string`
- **iconData**: `ArrayBuffer`
- **mimeType**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/modrinth/index.ts#L739" target="_blank" rel="noreferrer">packages/modrinth/index.ts:739</a>
</p>


