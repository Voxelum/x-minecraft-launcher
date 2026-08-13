# Interface InstallJavaRuntimeOptions

## 🏷️ Properties

### apiHost <Badge type="info" text="optional" />

```ts
apiHost: string | string[]
```
The alternative download host for the file
*Inherited from: `InstallJavaRuntimeBaseOptions.apiHost`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L255" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:255</a>
</p>


### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
*Inherited from: `InstallJavaRuntimeBaseOptions.checksum`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L271" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:271</a>
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
*Inherited from: `InstallJavaRuntimeBaseOptions.controller`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L29" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:29</a>
</p>


### destination

```ts
destination: string
```
The destination of this installation
*Inherited from: `InstallJavaRuntimeBaseOptions.destination`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L259" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:259</a>
</p>


### diagnose <Badge type="info" text="optional" />

```ts
diagnose: boolean
```
Whether to diagnose the installation. If true, will throw error instead of fixing.
*Inherited from: `InstallJavaRuntimeBaseOptions.diagnose`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L267" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:267</a>
</p>


### dispatcher <Badge type="info" text="optional" />

```ts
dispatcher: Dispatcher
```
*Inherited from: `InstallJavaRuntimeBaseOptions.dispatcher`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L20" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:20</a>
</p>


### manifest

```ts
manifest: JavaRuntimeManifest
```
The actual manfiest to install.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L282" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:282</a>
</p>


### rangePolicy <Badge type="info" text="optional" />

```ts
rangePolicy: RangePolicy | DefaultRangePolicyOptions
```
*Inherited from: `InstallJavaRuntimeBaseOptions.rangePolicy`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L19" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:19</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
Abort signal
*Inherited from: `InstallJavaRuntimeBaseOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L275" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:275</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<JavaRuntimeTrackerEvents>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L284" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:284</a>
</p>


### unpackLzma <Badge type="info" text="optional" />

```ts
unpackLzma: (lzmaFile: string, destinationFile: string) => Promise<void>
```
The unpacker for lzma file
*Inherited from: `InstallJavaRuntimeBaseOptions.unpackLzma`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L263" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:263</a>
</p>


