# Class FileSystem

## 🏭 Constructors

### constructor

```ts
FileSystem(): FileSystem
```
#### Return Type

- `FileSystem`


## 🏷️ Properties

### root <Badge type="tip" text="readonly" /> <Badge type="warning" text="abstract" />

```ts
root: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L2" target="_blank" rel="noreferrer">packages/system/system.ts:2</a>
</p>


### sep <Badge type="tip" text="readonly" /> <Badge type="warning" text="abstract" />

```ts
sep: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L3" target="_blank" rel="noreferrer">packages/system/system.ts:3</a>
</p>


### type <Badge type="tip" text="readonly" /> <Badge type="warning" text="abstract" />

```ts
type: "zip" | "path"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L4" target="_blank" rel="noreferrer">packages/system/system.ts:4</a>
</p>


### writeable <Badge type="tip" text="readonly" /> <Badge type="warning" text="abstract" />

```ts
writeable: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L5" target="_blank" rel="noreferrer">packages/system/system.ts:5</a>
</p>


## 🔧 Methods

### cd <Badge type="warning" text="abstract" />

```ts
cd(name: string): void
```
#### Parameters

- **name**: `string`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L36" target="_blank" rel="noreferrer">packages/system/system.ts:36</a>
</p>


### close

```ts
close(): void
```
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L41" target="_blank" rel="noreferrer">packages/system/system.ts:41</a>
</p>


### existsFile <Badge type="warning" text="abstract" />

```ts
existsFile(name: string): Promise<boolean>
```
#### Parameters

- **name**: `string`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L12" target="_blank" rel="noreferrer">packages/system/system.ts:12</a>
</p>


### getUrl

```ts
getUrl(name: string): string
```
Get the url for a file entry. If the system does not support get url. This should return an empty string.
#### Parameters

- **name**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L30" target="_blank" rel="noreferrer">packages/system/system.ts:30</a>
</p>


### isClosed

```ts
isClosed(): boolean
```
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L38" target="_blank" rel="noreferrer">packages/system/system.ts:38</a>
</p>


### isDirectory <Badge type="warning" text="abstract" />

```ts
isDirectory(name: string): Promise<boolean>
```
#### Parameters

- **name**: `string`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L11" target="_blank" rel="noreferrer">packages/system/system.ts:11</a>
</p>


### join <Badge type="warning" text="abstract" />

```ts
join(paths: string[]): string
```
#### Parameters

- **paths**: `string[]`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L9" target="_blank" rel="noreferrer">packages/system/system.ts:9</a>
</p>


### listFiles <Badge type="warning" text="abstract" />

```ts
listFiles(name: string): Promise<string[]>
```
#### Parameters

- **name**: `string`
#### Return Type

- `Promise<string[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L34" target="_blank" rel="noreferrer">packages/system/system.ts:34</a>
</p>


### missingFile

```ts
missingFile(name: string): Promise<boolean>
```
#### Parameters

- **name**: `string`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L45" target="_blank" rel="noreferrer">packages/system/system.ts:45</a>
</p>


### readFile <Badge type="warning" text="abstract" />

```ts
readFile(name: string, encoding: "utf-8" | "base64"): Promise<string>
```
#### Parameters

- **name**: `string`
- **encoding**: `"utf-8" | "base64"`
#### Return Type

- `Promise<string>`

```ts
readFile(name: string, encoding: undefined): Promise<Uint8Array<ArrayBufferLike>>
```
#### Parameters

- **name**: `string`
- **encoding**: `undefined`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

```ts
readFile(name: string): Promise<Uint8Array<ArrayBufferLike>>
```
#### Parameters

- **name**: `string`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

```ts
readFile(name: string, encoding: "utf-8" | "base64"): Promise<string | Uint8Array<ArrayBufferLike>>
```
#### Parameters

- **name**: `string`
- **encoding**: `"utf-8" | "base64"`
#### Return Type

- `Promise<string | Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L13" target="_blank" rel="noreferrer">packages/system/system.ts:13</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L14" target="_blank" rel="noreferrer">packages/system/system.ts:14</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L15" target="_blank" rel="noreferrer">packages/system/system.ts:15</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L16" target="_blank" rel="noreferrer">packages/system/system.ts:16</a>
</p>


### readFileBuffered

```ts
readFileBuffered(name: string): Promise<Uint8Array<ArrayBufferLike>>
```
Read a whole file into a ``Uint8Array`` using the fastest available strategy.
Zip-backed file systems override this to bypass the per-entry stream
pipeline; the default simply delegates to [readFile](#FileSystem.readFile).
#### Parameters

- **name**: `string`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L23" target="_blank" rel="noreferrer">packages/system/system.ts:23</a>
</p>


### walkFiles

```ts
walkFiles(target: string, walker: (path: string) => void | Promise<void>): Promise<void>
```
#### Parameters

- **target**: `string`
- **walker**: `(path: string) => void | Promise<void>`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/system/system.ts#L49" target="_blank" rel="noreferrer">packages/system/system.ts:49</a>
</p>


