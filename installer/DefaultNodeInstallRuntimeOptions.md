# Interface DefaultNodeInstallRuntimeOptions

## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (path: string, algorithm: string) => Promise<string>
```
*Inherited from: `NodeInstallRuntimeOptions.checksum`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L397" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:397</a>
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


### dispatcher <Badge type="info" text="optional" />

```ts
dispatcher: Dispatcher
```
*Inherited from: `DownloadBaseOptions.dispatcher`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L20" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:20</a>
</p>


### download <Badge type="info" text="optional" />

```ts
download: (files: InstallFile[]) => Promise<void>
```
*Inherited from: `NodeInstallRuntimeOptions.download`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L398" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:398</a>
</p>


### maxConcurrency <Badge type="info" text="optional" />

```ts
maxConcurrency: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.default.ts#L19" target="_blank" rel="noreferrer">packages/installer/installManifest.default.ts:19</a>
</p>


### rangePolicy <Badge type="info" text="optional" />

```ts
rangePolicy: RangePolicy | DefaultRangePolicyOptions
```
*Inherited from: `DownloadBaseOptions.rangePolicy`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L19" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:19</a>
</p>


### runJava <Badge type="info" text="optional" />

```ts
runJava: (command: JavaCommand) => Promise<void>
```
*Inherited from: `NodeInstallRuntimeOptions.runJava`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L399" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:399</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `NodeInstallRuntimeOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L396" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:396</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: ProgressTrackerMultiple
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.default.ts#L18" target="_blank" rel="noreferrer">packages/installer/installManifest.default.ts:18</a>
</p>


