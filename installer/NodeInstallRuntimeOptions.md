# Interface NodeInstallRuntimeOptions

## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (path: string, algorithm: string) => Promise<string>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L397" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:397</a>
</p>


### download <Badge type="info" text="optional" />

```ts
download: (files: InstallFile[]) => Promise<void>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L398" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:398</a>
</p>


### runJava <Badge type="info" text="optional" />

```ts
runJava: (command: JavaCommand) => Promise<void>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L399" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:399</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L396" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:396</a>
</p>


