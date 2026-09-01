# Interface InstallLabyModOptions

Shared install options
## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L30" target="_blank" rel="noreferrer">packages/installer/labymod.ts:30</a>
</p>


### environment <Badge type="info" text="optional" />

```ts
environment: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L22" target="_blank" rel="noreferrer">packages/installer/labymod.ts:22</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: (url: string, init?: RequestInit) => Promise<Response>
```
*Inherited from: `FetchOptions.fetch`*

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
*Inherited from: `InstallOptions.inheritsFrom`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L133" target="_blank" rel="noreferrer">packages/installer/utils.ts:133</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `FetchOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L46" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:46</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<LabyModTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L26" target="_blank" rel="noreferrer">packages/installer/labymod.ts:26</a>
</p>


### versionId <Badge type="info" text="optional" />

```ts
versionId: string
```
Override the newly installed version id.

If this is absent, the installed version id will be either generated or provided by installer.
*Inherited from: `InstallOptions.versionId`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L140" target="_blank" rel="noreferrer">packages/installer/utils.ts:140</a>
</p>


