# Interface FetchJavaRuntimeManifestOptions

## 🏷️ Properties

### apiHost <Badge type="info" text="optional" />

```ts
apiHost: string | string[]
```
The alternative download host for the file
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L75" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:75</a>
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


### fetch <Badge type="info" text="optional" />

```ts
fetch: (url: string, init?: RequestInit) => Promise<Response>
```
Custom fetch function
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L97" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:97</a>
</p>


### manifestIndex <Badge type="info" text="optional" />

```ts
manifestIndex: JavaRuntimes
```
The index manifest of the java runtime. If this is not presented, it will fetch by platform and all platform url.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L93" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:93</a>
</p>


### platform <Badge type="info" text="optional" />

```ts
platform: Platform
```
The platform to install. It will be auto-resolved by default.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L84" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:84</a>
</p>


### rangePolicy <Badge type="info" text="optional" />

```ts
rangePolicy: RangePolicy | DefaultRangePolicyOptions
```
*Inherited from: `DownloadBaseOptions.rangePolicy`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L19" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:19</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
Abort signal for fetch
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L101" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:101</a>
</p>


### target <Badge type="info" text="optional" />

```ts
target: string
```
The install java runtime type
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L89" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:89</a>
</p>


### url <Badge type="info" text="optional" />

```ts
url: string
```
The url of the all runtime json
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L79" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:79</a>
</p>


