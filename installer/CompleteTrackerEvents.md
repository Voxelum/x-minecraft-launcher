# Interface CompleteTrackerEvents

## 🏷️ Properties

### assets.assetIndex

```ts
assets.assetIndex: WithDownload<{ url: string | string[] }>
```
*Inherited from: `AssetsTrackerEvents.assets.assetIndex`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L22" target="_blank" rel="noreferrer">packages/installer/assets.ts:22</a>
</p>


### assets.assets

```ts
assets.assets: WithDownload<{ count: number }>
```
*Inherited from: `AssetsTrackerEvents.assets.assets`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L20" target="_blank" rel="noreferrer">packages/installer/assets.ts:20</a>
</p>


### assets.logConfig

```ts
assets.logConfig: WithDownload<{ url: string | string[] }>
```
*Inherited from: `AssetsTrackerEvents.assets.logConfig`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L21" target="_blank" rel="noreferrer">packages/installer/assets.ts:21</a>
</p>


### libraries

```ts
libraries: WithDownload<{ count: number }>
```
*Inherited from: `LibrariesTrackerEvents.libraries`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L20" target="_blank" rel="noreferrer">packages/installer/libraries.ts:20</a>
</p>


### postprocess

```ts
postprocess: { count: number }
```
*Inherited from: `ProfileTrackerEvents.postprocess`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L21" target="_blank" rel="noreferrer">packages/installer/profile.ts:21</a>
</p>


### version.jar

```ts
version.jar: WithDownload<{ id: string; sha1?: string; side: "server" | "client"; size: number }>
```
*Inherited from: `MinecraftTrackerEvents.version.jar`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L24" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:24</a>
</p>


### version.json

```ts
version.json: WithDownload<{ id: string; url: string }>
```
*Inherited from: `MinecraftTrackerEvents.version.json`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L23" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:23</a>
</p>


