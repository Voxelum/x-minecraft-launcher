# Interface AssetsOptions

Change the host url of assets download
## 🏷️ Properties

### abortSignal <Badge type="info" text="optional" />

```ts
abortSignal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L57" target="_blank" rel="noreferrer">packages/installer/assets.ts:57</a>
</p>


### assetsHost <Badge type="info" text="optional" />

```ts
assetsHost: string | string[]
```
The alternative assets host to download asset. It will try to use these host from the ``[0]`` to the ``[assetsHost.length - 1]``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L33" target="_blank" rel="noreferrer">packages/installer/assets.ts:33</a>
</p>


### assetsIndexUrl <Badge type="info" text="optional" />

```ts
assetsIndexUrl: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The assets index download or url replacement
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L41" target="_blank" rel="noreferrer">packages/installer/assets.ts:41</a>
</p>


### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L53" target="_blank" rel="noreferrer">packages/installer/assets.ts:53</a>
</p>


### diagnose <Badge type="info" text="optional" />

```ts
diagnose: boolean
```
*Inherited from: `WithDiagnose.diagnose`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L143" target="_blank" rel="noreferrer">packages/installer/utils.ts:143</a>
</p>


### fetch <Badge type="info" text="optional" />

```ts
fetch: { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; (input: string | Request | URL, init?: RequestInit): Promise<Response> }
```
The fetch implementation to use. Default is the global fetch
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L45" target="_blank" rel="noreferrer">packages/installer/assets.ts:45</a>
</p>


### strict <Badge type="info" text="optional" />

```ts
strict: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L55" target="_blank" rel="noreferrer">packages/installer/assets.ts:55</a>
</p>


### timestamp <Badge type="info" text="optional" />

```ts
timestamp: number
```
Timestamp of the last fully validated installation.
*Inherited from: `WithDiagnose.timestamp`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L145" target="_blank" rel="noreferrer">packages/installer/utils.ts:145</a>
</p>


### tracker <Badge type="info" text="optional" />

```ts
tracker: Tracker<AssetsTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L49" target="_blank" rel="noreferrer">packages/installer/assets.ts:49</a>
</p>


### useHashForAssetsIndex <Badge type="info" text="optional" />

```ts
useHashForAssetsIndex: boolean
```
Use hash as the assets index file name. Default is ``false``
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L37" target="_blank" rel="noreferrer">packages/installer/assets.ts:37</a>
</p>


