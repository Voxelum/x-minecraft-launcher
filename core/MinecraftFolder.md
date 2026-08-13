# Class MinecraftFolder

The Minecraft folder structure. All method will return the path related to a minecraft root like ``.minecraft``.
## 🏭 Constructors

### constructor

```ts
MinecraftFolder(root: string): MinecraftFolder
```
#### Parameters

- **root**: `string`
#### Return Type

- `MinecraftFolder`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L22" target="_blank" rel="noreferrer">packages/core/folder.ts:22</a>
</p>


## 🏷️ Properties

### root <Badge type="tip" text="readonly" />

```ts
root: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L4" target="_blank" rel="noreferrer">packages/core/folder.ts:4</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L22" target="_blank" rel="noreferrer">packages/core/folder.ts:22</a>
</p>


## 🔑 Accessors

### assets

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L30" target="_blank" rel="noreferrer">packages/core/folder.ts:30</a>
</p>


### lastestLog

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L48" target="_blank" rel="noreferrer">packages/core/folder.ts:48</a>
</p>


### launcherProfile

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L45" target="_blank" rel="noreferrer">packages/core/folder.ts:45</a>
</p>


### libraries

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L33" target="_blank" rel="noreferrer">packages/core/folder.ts:33</a>
</p>


### logs

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L39" target="_blank" rel="noreferrer">packages/core/folder.ts:39</a>
</p>


### maps

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L51" target="_blank" rel="noreferrer">packages/core/folder.ts:51</a>
</p>


### mods

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L24" target="_blank" rel="noreferrer">packages/core/folder.ts:24</a>
</p>


### options

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L42" target="_blank" rel="noreferrer">packages/core/folder.ts:42</a>
</p>


### resourcepacks

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L27" target="_blank" rel="noreferrer">packages/core/folder.ts:27</a>
</p>


### saves

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L54" target="_blank" rel="noreferrer">packages/core/folder.ts:54</a>
</p>


### screenshots

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L57" target="_blank" rel="noreferrer">packages/core/folder.ts:57</a>
</p>


### versions

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L36" target="_blank" rel="noreferrer">packages/core/folder.ts:36</a>
</p>


## 🔧 Methods

### getAsset

```ts
getAsset(hash: string): string
```
#### Parameters

- **hash**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L117" target="_blank" rel="noreferrer">packages/core/folder.ts:117</a>
</p>


### getAssetsIndex

```ts
getAssetsIndex(versionAssets: string): string
```
#### Parameters

- **versionAssets**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L114" target="_blank" rel="noreferrer">packages/core/folder.ts:114</a>
</p>


### getLibraryByPath

```ts
getLibraryByPath(libraryPath: string): string
```
#### Parameters

- **libraryPath**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L110" target="_blank" rel="noreferrer">packages/core/folder.ts:110</a>
</p>


### getLog

```ts
getLog(fileName: string): string
```
#### Parameters

- **fileName**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L101" target="_blank" rel="noreferrer">packages/core/folder.ts:101</a>
</p>


### getLogConfig

```ts
getLogConfig(file: string): string
```
#### Parameters

- **file**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L120" target="_blank" rel="noreferrer">packages/core/folder.ts:120</a>
</p>


### getMapIcon

```ts
getMapIcon(map: string): string
```
#### Parameters

- **map**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L107" target="_blank" rel="noreferrer">packages/core/folder.ts:107</a>
</p>


### getMapInfo

```ts
getMapInfo(map: string): string
```
#### Parameters

- **map**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L104" target="_blank" rel="noreferrer">packages/core/folder.ts:104</a>
</p>


### getMod

```ts
getMod(fileName: string): string
```
#### Parameters

- **fileName**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L98" target="_blank" rel="noreferrer">packages/core/folder.ts:98</a>
</p>


### getNativesRoot

```ts
getNativesRoot(version: string): string
```
#### Parameters

- **version**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L61" target="_blank" rel="noreferrer">packages/core/folder.ts:61</a>
</p>


### getPath

```ts
getPath(path: string[]): string
```
#### Parameters

- **path**: `string[]`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L123" target="_blank" rel="noreferrer">packages/core/folder.ts:123</a>
</p>


### getResourcePack

```ts
getResourcePack(fileName: string): string
```
#### Parameters

- **fileName**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L95" target="_blank" rel="noreferrer">packages/core/folder.ts:95</a>
</p>


### getVersionAll

```ts
getVersionAll(version: string): string[]
```
#### Parameters

- **version**: `string`
#### Return Type

- `string[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L87" target="_blank" rel="noreferrer">packages/core/folder.ts:87</a>
</p>


### getVersionJar

```ts
getVersionJar(version: string, type: string): string
```
#### Parameters

- **version**: `string`
- **type**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L73" target="_blank" rel="noreferrer">packages/core/folder.ts:73</a>
</p>


### getVersionJson

```ts
getVersionJson(version: string): string
```
#### Parameters

- **version**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L67" target="_blank" rel="noreferrer">packages/core/folder.ts:67</a>
</p>


### getVersionRoot

```ts
getVersionRoot(version: string): string
```
#### Parameters

- **version**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L64" target="_blank" rel="noreferrer">packages/core/folder.ts:64</a>
</p>


### getVersionServerJson

```ts
getVersionServerJson(version: string): string
```
#### Parameters

- **version**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L70" target="_blank" rel="noreferrer">packages/core/folder.ts:70</a>
</p>


### from <Badge type="warning" text="static" />

```ts
from(location: MinecraftLocation): MinecraftFolder
```
Normal a Minecraft folder from a folder or string
#### Parameters

- **location**: `MinecraftLocation`
#### Return Type

- `MinecraftFolder`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L14" target="_blank" rel="noreferrer">packages/core/folder.ts:14</a>
</p>


