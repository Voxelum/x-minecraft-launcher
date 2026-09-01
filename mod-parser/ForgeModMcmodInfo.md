# Interface ForgeModMcmodInfo

Represent the forge ``mcmod.info`` format.
## 🏷️ Properties

### authorList

```ts
authorList: string[]
```
A list of authors to this mod.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L104" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:104</a>
</p>


### credits

```ts
credits: string
```
A string that contains any acknowledgements you want to mention.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L108" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:108</a>
</p>


### dependants

```ts
dependants: string[]
```
A list of modids. All of the listed mods will load after this one. If one is not present, nothing happens.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L136" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:136</a>
</p>


### dependencies

```ts
dependencies: string[]
```
A list of modids. All of the listed mods will load before this one. If one is not present, nothing happens.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L132" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:132</a>
</p>


### description

```ts
description: string
```
A description of this mod in 1-2 paragraphs.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L80" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:80</a>
</p>


### logoFile

```ts
logoFile: string
```
The path to the mod’s logo. It is resolved on top of the classpath, so you should put it in a location where the name will not conflict, maybe under your own assets folder.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L112" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:112</a>
</p>


### mcversion

```ts
mcversion: string
```
The Minecraft version.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L88" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:88</a>
</p>


### modid

```ts
modid: string
```
The modid this description is linked to. If the mod is not loaded, the description is ignored.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L72" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:72</a>
</p>


### name

```ts
name: string
```
The user-friendly name of this mod.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L76" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:76</a>
</p>


### parent

```ts
parent: string
```
The modid of a parent mod, if applicable. Using this allows modules of another mod to be listed under it in the info page, like BuildCraft.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L120" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:120</a>
</p>


### requiredMods

```ts
requiredMods: string[]
```
A list of modids. If one is missing, the game will crash. This does not affect the ordering of mod loading! To specify ordering as well as requirement, have a coupled entry in dependencies.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L128" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:128</a>
</p>


### screenshots

```ts
screenshots: string[]
```
A list of images to be shown on the info page. Currently unimplemented.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L116" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:116</a>
</p>


### updateJSON

```ts
updateJSON: string
```
The URL to a version JSON.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L100" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:100</a>
</p>


### updateUrl

```ts
updateUrl: string
```
Defined but unused. Superseded by updateJSON.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L96" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:96</a>
</p>


### url

```ts
url: string
```
A link to the mod’s homepage.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L92" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:92</a>
</p>


### useDependencyInformation

```ts
useDependencyInformation: boolean
```
If true and ``Mod.useMetadata``, the below 3 lists of dependencies will be used. If not, they do nothing.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L124" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:124</a>
</p>


### version

```ts
version: string
```
The version of the mod.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/mod-parser/forge.ts#L84" target="_blank" rel="noreferrer">packages/mod-parser/forge.ts:84</a>
</p>


