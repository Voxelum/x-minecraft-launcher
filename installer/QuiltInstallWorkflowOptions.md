# Interface QuiltInstallWorkflowOptions

Shared install options
## 🏷️ Properties

### fetch <Badge type="info" text="optional" />

```ts
fetch: (url: string, init?: RequestInit) => Promise<Response>
```
*Inherited from: `InstallQuiltVersionOptions.fetch`*

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
*Inherited from: `InstallQuiltVersionOptions.inheritsFrom`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L133" target="_blank" rel="noreferrer">packages/installer/utils.ts:133</a>
</p>


### minecraft

```ts
minecraft: MinecraftLocation
```
*Inherited from: `InstallQuiltVersionOptions.minecraft`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L19" target="_blank" rel="noreferrer">packages/installer/quilt.ts:19</a>
</p>


### minecraftVersion

```ts
minecraftVersion: string
```
*Inherited from: `InstallQuiltVersionOptions.minecraftVersion`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L17" target="_blank" rel="noreferrer">packages/installer/quilt.ts:17</a>
</p>


### profileUrls <Badge type="info" text="optional" />

```ts
profileUrls: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L24" target="_blank" rel="noreferrer">packages/installer/quilt.ts:24</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
*Inherited from: `InstallQuiltVersionOptions.side`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L20" target="_blank" rel="noreferrer">packages/installer/quilt.ts:20</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `InstallQuiltVersionOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L46" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:46</a>
</p>


### version

```ts
version: string
```
*Inherited from: `InstallQuiltVersionOptions.version`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L18" target="_blank" rel="noreferrer">packages/installer/quilt.ts:18</a>
</p>


### versionId <Badge type="info" text="optional" />

```ts
versionId: string
```
Override the newly installed version id.

If this is absent, the installed version id will be either generated or provided by installer.
*Inherited from: `InstallQuiltVersionOptions.versionId`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L140" target="_blank" rel="noreferrer">packages/installer/utils.ts:140</a>
</p>


