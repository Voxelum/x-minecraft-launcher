# Interface FetchJavaRuntimeManifestOptions

## 🏷️ Properties

### apiHost <Badge type="info" text="optional" />

```ts
apiHost: string | string[]
```
The alternative download host for the file
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L164" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:164</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: (url: string, init?: RequestInit) => Promise<Response>
```
*Inherited from: `FetchOptions.fetch`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L45" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:45</a>
</p>


### manifestIndex <Badge type="info" text="optional" />

```ts
manifestIndex: JavaRuntimes
```
The index manifest of the java runtime. If this is not presented, it will fetch by platform and all platform url.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L182" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:182</a>
</p>


### platform <Badge type="info" text="optional" />

```ts
platform: Platform
```
The platform to install. It will be auto-resolved by default.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L173" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:173</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `FetchOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.browser.ts#L46" target="_blank" rel="noreferrer">packages/installer/utils.browser.ts:46</a>
</p>


### target <Badge type="info" text="optional" />

```ts
target: string
```
The install java runtime type
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L178" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:178</a>
</p>


### url <Badge type="info" text="optional" />

```ts
url: string
```
The url of the all runtime json
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L168" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:168</a>
</p>


