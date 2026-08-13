# Interface AssetsOptions

Change the host url of assets download
## 🏷️ Properties

### abortSignal <Badge type="info" text="optional" />

```ts
abortSignal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L66" target="_blank" rel="noreferrer">packages/installer/assets.ts:66</a>
</p>


### assetsHost <Badge type="info" text="optional" />

```ts
assetsHost: string | string[]
```
The alternative assets host to download asset. It will try to use these host from the ``[0]`` to the ``[assetsHost.length - 1]``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L42" target="_blank" rel="noreferrer">packages/installer/assets.ts:42</a>
</p>


### assetsIndexUrl <Badge type="info" text="optional" />

```ts
assetsIndexUrl: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The assets index download or url replacement
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L50" target="_blank" rel="noreferrer">packages/installer/assets.ts:50</a>
</p>


### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L62" target="_blank" rel="noreferrer">packages/installer/assets.ts:62</a>
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
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L54" target="_blank" rel="noreferrer">packages/installer/assets.ts:54</a>
</p>


### rangePolicy <Badge type="info" text="optional" />

```ts
rangePolicy: RangePolicy | DefaultRangePolicyOptions
```
*Inherited from: `DownloadBaseOptions.rangePolicy`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L19" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:19</a>
</p>


### strict <Badge type="info" text="optional" />

```ts
strict: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L64" target="_blank" rel="noreferrer">packages/installer/assets.ts:64</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<AssetsTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L58" target="_blank" rel="noreferrer">packages/installer/assets.ts:58</a>
</p>


### useHashForAssetsIndex <Badge type="info" text="optional" />

```ts
useHashForAssetsIndex: boolean
```
Use hash as the assets index file name. Default is ``false``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L46" target="_blank" rel="noreferrer">packages/installer/assets.ts:46</a>
</p>


