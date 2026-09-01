# Interface ExecuteInstallWorkflowOptions

## 🏷️ Properties

### attempts <Badge type="info" text="optional" />

```ts
attempts: number
```
*Inherited from: `ExecuteInstallManifestOptions.attempts`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L123" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:123</a>
</p>


### maxStages <Badge type="info" text="optional" />

```ts
maxStages: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L152" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:152</a>
</p>


### now <Badge type="info" text="optional" />

```ts
now: () => number
```
*Inherited from: `ExecuteInstallManifestOptions.now`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L129" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:129</a>
</p>


### onEvent <Badge type="info" text="optional" />

```ts
onEvent: (event: InstallEvent) => void
```
*Inherited from: `ExecuteInstallManifestOptions.onEvent`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L130" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:130</a>
</p>


### random <Badge type="info" text="optional" />

```ts
random: () => number
```
*Inherited from: `ExecuteInstallManifestOptions.random`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L126" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:126</a>
</p>


### retryBaseDelay <Badge type="info" text="optional" />

```ts
retryBaseDelay: number
```
*Inherited from: `ExecuteInstallManifestOptions.retryBaseDelay`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L124" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:124</a>
</p>


### retryMaxDelay <Badge type="info" text="optional" />

```ts
retryMaxDelay: number
```
*Inherited from: `ExecuteInstallManifestOptions.retryMaxDelay`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L125" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:125</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `ExecuteInstallManifestOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L128" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:128</a>
</p>


### wait <Badge type="info" text="optional" />

```ts
wait: (delay: number, signal?: AbortSignal) => Promise<void>
```
*Inherited from: `ExecuteInstallManifestOptions.wait`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L127" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:127</a>
</p>


