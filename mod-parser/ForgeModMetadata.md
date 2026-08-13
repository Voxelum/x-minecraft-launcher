# Interface ForgeModMetadata

Represnet a full scan of a mod file data.
## 🏷️ Properties

### fmlPluginClassName <Badge type="info" text="optional" />

```ts
fmlPluginClassName: string
```
*Inherited from: `ForgeModASMData.fmlPluginClassName`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L229" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:229</a>
</p>


### fmlPluginMcVersion <Badge type="info" text="optional" />

```ts
fmlPluginMcVersion: string
```
*Inherited from: `ForgeModASMData.fmlPluginMcVersion`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L230" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:230</a>
</p>


### manifest

```ts
manifest: Record<string, any>
```
The java manifest file data. If no metadata, it will be an empty object
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L757" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:757</a>
</p>


### manifestMetadata <Badge type="info" text="optional" />

```ts
manifestMetadata: ManifestMetadata
```
The mod info extract from manfiest. If no manifest, it will be undefined!
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L761" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:761</a>
</p>


### mcmodInfo

```ts
mcmodInfo: ForgeModMcmodInfo[]
```
The mcmod.info file metadata. If no mcmod.info file, it will be an empty array
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L753" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:753</a>
</p>


### modAnnotations

```ts
modAnnotations: ForgeModAnnotationData[]
```
*Inherited from: `ForgeModASMData.modAnnotations`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L232" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:232</a>
</p>


### modsToml

```ts
modsToml: ForgeModTOMLData[]
```
The toml mod metadata
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L765" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:765</a>
</p>


### usedForgePackage

```ts
usedForgePackage: boolean
```
Does class files contain forge package
*Inherited from: `ForgeModASMData.usedForgePackage`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L219" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:219</a>
</p>


### usedLegacyFMLPackage

```ts
usedLegacyFMLPackage: boolean
```
Does class files contain cpw package
*Inherited from: `ForgeModASMData.usedLegacyFMLPackage`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L215" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:215</a>
</p>


### usedMinecraftClientPackage

```ts
usedMinecraftClientPackage: boolean
```
Does class files contain minecraft.client package
*Inherited from: `ForgeModASMData.usedMinecraftClientPackage`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L227" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:227</a>
</p>


### usedMinecraftPackage

```ts
usedMinecraftPackage: boolean
```
Does class files contain minecraft package
*Inherited from: `ForgeModASMData.usedMinecraftPackage`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L223" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:223</a>
</p>


