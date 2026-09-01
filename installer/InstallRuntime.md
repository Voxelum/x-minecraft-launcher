# Interface InstallRuntime

## 🔧 Methods

### checksum

```ts
checksum(path: string, algorithm: string): Promise<string>
```
#### Parameters

- **path**: `string`
- **algorithm**: `string`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L104" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:104</a>
</p>


### download

```ts
download(files: InstallFile[]): Promise<void>
```
#### Parameters

- **files**: `InstallFile[]`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L105" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:105</a>
</p>


### java

```ts
java(command: JavaCommand): Promise<void>
```
#### Parameters

- **command**: `JavaCommand`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L106" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:106</a>
</p>


### materialize

```ts
materialize(operations: InstallMaterializeOperation[]): Promise<{ commit: any; rollback: any }>
```
#### Parameters

- **operations**: `InstallMaterializeOperation[]`
#### Return Type

- `Promise<{ commit: any; rollback: any }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L107" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:107</a>
</p>


### remove

```ts
remove(paths: string[]): Promise<void>
```
#### Parameters

- **paths**: `string[]`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L111" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:111</a>
</p>


### stat

```ts
stat(path: string): Promise<{ mtimeMs: number; size: number } | undefined>
```
#### Parameters

- **path**: `string`
#### Return Type

- `Promise<{ mtimeMs: number; size: number } | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L103" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:103</a>
</p>


### validate

```ts
validate(path: string, validator: NonNullable<"json" | "file" | "zip" | undefined>): Promise<boolean>
```
#### Parameters

- **path**: `string`
- **validator**: `NonNullable<"json" | "file" | "zip" | undefined>`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L112" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:112</a>
</p>


