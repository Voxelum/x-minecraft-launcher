# Interface FabricInstallWorkflowOptions

Shared install options
## 🏷️ Properties

### fetch <Badge type="info" text="optional" />

```ts
fetch: (url: string, init?: RequestInit) => Promise<Response>
```
*Inherited from: `InstallFabricVersionOptions.fetch`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L45" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:45</a>
</p>


### inheritsFrom <Badge type="info" text="optional" />

```ts
inheritsFrom: string
```
When you want to install a version over another one.

Like, you want to install liteloader over a forge version.
You should fill this with that forge version id.
*Inherited from: `InstallFabricVersionOptions.inheritsFrom`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L133" target="_blank" rel="noreferrer">packages/installer/utils.ts:133</a>
</p>


### minecraft

```ts
minecraft: MinecraftLocation
```
*Inherited from: `InstallFabricVersionOptions.minecraft`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L78" target="_blank" rel="noreferrer">packages/installer/fabric.ts:78</a>
</p>


### minecraftVersion

```ts
minecraftVersion: string
```
*Inherited from: `InstallFabricVersionOptions.minecraftVersion`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L76" target="_blank" rel="noreferrer">packages/installer/fabric.ts:76</a>
</p>


### profileUrls <Badge type="info" text="optional" />

```ts
profileUrls: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L83" target="_blank" rel="noreferrer">packages/installer/fabric.ts:83</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
*Inherited from: `InstallFabricVersionOptions.side`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L79" target="_blank" rel="noreferrer">packages/installer/fabric.ts:79</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `InstallFabricVersionOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L46" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:46</a>
</p>


### version

```ts
version: string
```
*Inherited from: `InstallFabricVersionOptions.version`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L77" target="_blank" rel="noreferrer">packages/installer/fabric.ts:77</a>
</p>


### versionId <Badge type="info" text="optional" />

```ts
versionId: string
```
Override the newly installed version id.

If this is absent, the installed version id will be either generated or provided by installer.
*Inherited from: `InstallFabricVersionOptions.versionId`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L140" target="_blank" rel="noreferrer">packages/installer/utils.ts:140</a>
</p>


