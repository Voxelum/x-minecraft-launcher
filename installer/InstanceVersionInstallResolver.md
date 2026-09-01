# Interface InstanceVersionInstallResolver

## 🔧 Methods

### findLocalVersion

```ts
findLocalVersion(runtime: InstanceVersionRuntime): Promise<InstanceVersionHeader | undefined>
```
#### Parameters

- **runtime**: `InstanceVersionRuntime`
#### Return Type

- `Promise<InstanceVersionHeader | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L60" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:60</a>
</p>


### getForgeVersion <Badge type="info" text="optional" />

```ts
getForgeVersion(minecraft: string, forge: string): Promise<{ installer?: { path: string; sha1?: string }; version: string } | undefined>
```
#### Parameters

- **minecraft**: `string`
- **forge**: `string`
#### Return Type

- `Promise<{ installer?: { path: string; sha1?: string }; version: string } | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L61" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:61</a>
</p>


### getLabyModManifest <Badge type="info" text="optional" />

```ts
getLabyModManifest(): Promise<LabyModManifest>
```
#### Return Type

- `Promise<LabyModManifest>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L66" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:66</a>
</p>


### getMinecraftVersion

```ts
getMinecraftVersion(version: string): Promise<MinecraftVersion | undefined>
```
#### Parameters

- **version**: `string`
#### Return Type

- `Promise<MinecraftVersion | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L59" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:59</a>
</p>


### getNeoForgedVersion <Badge type="info" text="optional" />

```ts
getNeoForgedVersion(minecraft: string, neoForged: string): Promise<string | undefined>
```
#### Parameters

- **minecraft**: `string`
- **neoForged**: `string`
#### Return Type

- `Promise<string | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L65" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:65</a>
</p>


