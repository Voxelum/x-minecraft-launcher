# Interface ExecuteInstallManifestOptions

## 🏷️ Properties

### attempts <Badge type="info" text="optional" />

```ts
attempts: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L123" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:123</a>
</p>


### now <Badge type="info" text="optional" />

```ts
now: () => number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L129" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:129</a>
</p>


### onEvent <Badge type="info" text="optional" />

```ts
onEvent: (event: InstallEvent) => void
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L130" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:130</a>
</p>


### random <Badge type="info" text="optional" />

```ts
random: () => number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L126" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:126</a>
</p>


### retryBaseDelay <Badge type="info" text="optional" />

```ts
retryBaseDelay: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L124" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:124</a>
</p>


### retryMaxDelay <Badge type="info" text="optional" />

```ts
retryMaxDelay: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L125" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:125</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L128" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:128</a>
</p>


### wait <Badge type="info" text="optional" />

```ts
wait: (delay: number, signal?: AbortSignal) => Promise<void>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L127" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:127</a>
</p>


