# Interface InstallJavaTask

## 🏷️ Properties

### dependsOn <Badge type="info" text="optional" />

```ts
dependsOn: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L59" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:59</a>
</p>


### id

```ts
id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L54" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:54</a>
</p>


### metadata <Badge type="info" text="optional" />

```ts
metadata: Record<string, string | number | boolean>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L60" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:60</a>
</p>


### outputs

```ts
outputs: InstallOutput[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L58" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:58</a>
</p>


### strategies

```ts
strategies: JavaCommand[][]
```
Strategies are tried in order. Commands inside one strategy run sequentially.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L57" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:57</a>
</p>


### type

```ts
type: "java"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L55" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:55</a>
</p>


