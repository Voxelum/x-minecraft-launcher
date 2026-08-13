# Interface CompleteOptions

## 🏷️ Properties

### abortSignal <Badge type="info" text="optional" />

```ts
abortSignal: AbortSignal
```
*Inherited from: `AssetsOptions.abortSignal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L66" target="_blank" rel="noreferrer">packages/installer/assets.ts:66</a>
</p>


### assetsHost <Badge type="info" text="optional" />

```ts
assetsHost: string | string[]
```
The alternative assets host to download asset. It will try to use these host from the ``[0]`` to the ``[assetsHost.length - 1]``
*Inherited from: `AssetsOptions.assetsHost`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L42" target="_blank" rel="noreferrer">packages/installer/assets.ts:42</a>
</p>


### assetsIndexUrl <Badge type="info" text="optional" />

```ts
assetsIndexUrl: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The assets index download or url replacement
*Inherited from: `AssetsOptions.assetsIndexUrl`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L50" target="_blank" rel="noreferrer">packages/installer/assets.ts:50</a>
</p>


### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
*Inherited from: `JarOption.checksum`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L67" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:67</a>
</p>


### client <Badge type="info" text="optional" />

```ts
client: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The client jar url replacement
*Inherited from: `JarOption.client`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L55" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:55</a>
</p>


### controller <Badge type="info" text="optional" />

```ts
controller: DownloadController
```
Optional adaptive strategy. When supplied, the download runs as a
single resumable stream whose throughput is sampled, and the
controller may request a managed abort that resumes (via HTTP
``Range``) on a fresh connection instead of failing. When omitted,
the classic parallel-range / multi-URL-fallback path is used and
behaviour is unchanged.
*Inherited from: `DownloadBaseOptions.controller`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L29" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:29</a>
</p>


### diagnose <Badge type="info" text="optional" />

```ts
diagnose: boolean
```
*Inherited from: `WithDiagnose.diagnose`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L143" target="_blank" rel="noreferrer">packages/installer/utils.ts:143</a>
</p>


### dispatcher <Badge type="info" text="optional" />

```ts
dispatcher: Dispatcher
```
*Inherited from: `DownloadBaseOptions.dispatcher`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L20" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:20</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; (input: string | Request | URL, init?: RequestInit): Promise<Response> }
```
The fetch implementation to use. Default is the global fetch
*Inherited from: `AssetsOptions.fetch`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L54" target="_blank" rel="noreferrer">packages/installer/assets.ts:54</a>
</p>


### handler <Badge type="info" text="optional" />

```ts
handler: (postProcessor: PostProcessor) => Promise<boolean>
```
Custom handlers to handle the post processor
*Inherited from: `PostProcessOptions.handler`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L84" target="_blank" rel="noreferrer">packages/installer/profile.ts:84</a>
</p>


### installJar <Badge type="info" text="optional" />

```ts
installJar: boolean
```
Whether to install the Minecraft jar after resolving the version JSON.
*Inherited from: `JarOption.installJar`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L47" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:47</a>
</p>


### java <Badge type="info" text="optional" />

```ts
java: string
```
New forge (&gt;=1.13) require java to install. Can be a executor or java executable path.
*Inherited from: `InstallProfileOption.java`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L107" target="_blank" rel="noreferrer">packages/installer/profile.ts:107</a>
</p>


### json <Badge type="info" text="optional" />

```ts
json: string | string[] | ((version: MinecraftVersionBaseInfo) => string | string[])
```
The version json url replacement
*Inherited from: `JarOption.json`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L51" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:51</a>
</p>


### libraryHost <Badge type="info" text="optional" />

```ts
libraryHost: LibraryHost
```
A more flexiable way to control library download url.
*Inherited from: `LibraryOptions.libraryHost`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L36" target="_blank" rel="noreferrer">packages/installer/libraries.ts:36</a>
</p>


### mavenHost <Badge type="info" text="optional" />

```ts
mavenHost: string | string[]
```
The alterative maven host to download library. It will try to use these host from the ``[0]`` to the ``[maven.length - 1]``
*Inherited from: `LibraryOptions.mavenHost`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L40" target="_blank" rel="noreferrer">packages/installer/libraries.ts:40</a>
</p>


### postprocess <Badge type="info" text="optional" />

```ts
postprocess: (processor: PostProcessor[], minecraftFolder: MinecraftFolder, options: PostProcessOptions, postprocess: () => Promise<void>) => Promise<void>
```
*Inherited from: `PostProcessOptions.postprocess`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L86" target="_blank" rel="noreferrer">packages/installer/profile.ts:86</a>
</p>


### rangePolicy <Badge type="info" text="optional" />

```ts
rangePolicy: RangePolicy | DefaultRangePolicyOptions
```
*Inherited from: `DownloadBaseOptions.rangePolicy`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L19" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:19</a>
</p>


### server <Badge type="info" text="optional" />

```ts
server: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The server jar url replacement
*Inherited from: `JarOption.server`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L59" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:59</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
The installation side
*Inherited from: `InstallSideOption.side`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L76" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:76</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `JarOption.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L69" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:69</a>
</p>


### spawn <Badge type="info" text="optional" />

```ts
spawn: (command: string, args?: readonly string[], options?: SpawnOptions) => ChildProcess
```
The spawn process function. Used for spawn the java process at the end.

By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
*Inherited from: `SpawnJavaOptions.spawn`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L66" target="_blank" rel="noreferrer">packages/installer/utils.ts:66</a>
</p>


### strict <Badge type="info" text="optional" />

```ts
strict: boolean
```
*Inherited from: `LibraryOptions.strict`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L50" target="_blank" rel="noreferrer">packages/installer/libraries.ts:50</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<CompleteTrackerEvents>
```
The tracker to track the complete installation process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installer.ts#L44" target="_blank" rel="noreferrer">packages/installer/installer.ts:44</a>
</p>


### useHashForAssetsIndex <Badge type="info" text="optional" />

```ts
useHashForAssetsIndex: boolean
```
Use hash as the assets index file name. Default is ``false``
*Inherited from: `AssetsOptions.useHashForAssetsIndex`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L46" target="_blank" rel="noreferrer">packages/installer/assets.ts:46</a>
</p>


