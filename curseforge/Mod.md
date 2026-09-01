# Interface Mod

## 🏷️ Properties

### allowModDistribution

```ts
allowModDistribution: boolean | null
```
Is mod allowed to be distributed
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L132" target="_blank" rel="noreferrer">packages/curseforge/index.ts:132</a>
</p>


### authors

```ts
authors: Author[]
```
The list of authors
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L107" target="_blank" rel="noreferrer">packages/curseforge/index.ts:107</a>
</p>


### categories

```ts
categories: ModCategory[]
```
List of categories that this mod is related to
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L99" target="_blank" rel="noreferrer">packages/curseforge/index.ts:99</a>
</p>


### classId

```ts
classId: number | null
```
The class id this mod belongs to
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L103" target="_blank" rel="noreferrer">packages/curseforge/index.ts:103</a>
</p>


### dateCreated

```ts
dateCreated: string
```
The creation date of the mod
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L124" target="_blank" rel="noreferrer">packages/curseforge/index.ts:124</a>
</p>


### dateModified

```ts
dateModified: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L126" target="_blank" rel="noreferrer">packages/curseforge/index.ts:126</a>
</p>


### dateReleased

```ts
dateReleased: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L127" target="_blank" rel="noreferrer">packages/curseforge/index.ts:127</a>
</p>


### defaultFileId

```ts
defaultFileId: number
```
The default download file id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L145" target="_blank" rel="noreferrer">packages/curseforge/index.ts:145</a>
</p>


### downloadCount

```ts
downloadCount: number
```
Number of downloads for the mod
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L87" target="_blank" rel="noreferrer">packages/curseforge/index.ts:87</a>
</p>


### gameId

```ts
gameId: number
```
Game id. Minecraft is 432.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L60" target="_blank" rel="noreferrer">packages/curseforge/index.ts:60</a>
</p>


### gamePopularityRank

```ts
gamePopularityRank: number
```
The mod popularity rank for the game
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L136" target="_blank" rel="noreferrer">packages/curseforge/index.ts:136</a>
</p>


### id

```ts
id: number
```
The addon id. You can use this in many functions required the ``addonID``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L56" target="_blank" rel="noreferrer">packages/curseforge/index.ts:56</a>
</p>


### isAvailable

```ts
isAvailable: boolean
```
Is the mod available for search. This can be false when a mod is experimental, in a deleted state or has only alpha files
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L140" target="_blank" rel="noreferrer">packages/curseforge/index.ts:140</a>
</p>


### isFeatured

```ts
isFeatured: boolean
```
Whether the mod is included in the featured mods list
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L91" target="_blank" rel="noreferrer">packages/curseforge/index.ts:91</a>
</p>


### latestFiles

```ts
latestFiles: File[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L116" target="_blank" rel="noreferrer">packages/curseforge/index.ts:116</a>
</p>


### latestFilesIndexes

```ts
latestFilesIndexes: FileIndex[]
```
List of file related details for the latest files of the mod
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L120" target="_blank" rel="noreferrer">packages/curseforge/index.ts:120</a>
</p>


### links

```ts
links: { issuesUrl: string; sourceUrl: string; websiteUrl: string; wikiUrl: string }
```
Relevant links for the mod such as Issue tracker and Wiki
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L70" target="_blank" rel="noreferrer">packages/curseforge/index.ts:70</a>
</p>


### logo

```ts
logo: ModAsset
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L109" target="_blank" rel="noreferrer">packages/curseforge/index.ts:109</a>
</p>


### mainFileId

```ts
mainFileId: number
```
The id of the main file of the mod
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L115" target="_blank" rel="noreferrer">packages/curseforge/index.ts:115</a>
</p>


### name

```ts
name: string
```
The display name of the addon
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L64" target="_blank" rel="noreferrer">packages/curseforge/index.ts:64</a>
</p>


### primaryCategoryId

```ts
primaryCategoryId: number
```
The main category of the mod as it was chosen by the mod author
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L95" target="_blank" rel="noreferrer">packages/curseforge/index.ts:95</a>
</p>


### screenshots

```ts
screenshots: ModAsset[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L111" target="_blank" rel="noreferrer">packages/curseforge/index.ts:111</a>
</p>


### slug

```ts
slug: string
```
The mod slug that would appear in the URL
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L68" target="_blank" rel="noreferrer">packages/curseforge/index.ts:68</a>
</p>


### status

```ts
status: ModStatus
```
Current mod status
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L83" target="_blank" rel="noreferrer">packages/curseforge/index.ts:83</a>
</p>


### summary

```ts
summary: string
```
One line summery
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L79" target="_blank" rel="noreferrer">packages/curseforge/index.ts:79</a>
</p>


### thumbsUpCount

```ts
thumbsUpCount: number
```
The mod's thumbs up count
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/curseforge/index.ts#L149" target="_blank" rel="noreferrer">packages/curseforge/index.ts:149</a>
</p>


