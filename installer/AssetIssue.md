# Interface AssetIssue

The asset issue represents a corrupted or missing minecraft asset file.
Use ``resolveAssetInstallFiles`` with an install runtime to repair it.
## 🏷️ Properties

### asset

```ts
asset: { hash: string; name: string; size: number }
```
The problematic asset
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L149" target="_blank" rel="noreferrer">packages/installer/assets.ts:149</a>
</p>


### expectedChecksum

```ts
expectedChecksum: string
```
The expected checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
*Inherited from: `Issue.expectedChecksum`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L27" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:27</a>
</p>


### file

```ts
file: string
```
The path of the problematic file.
*Inherited from: `Issue.file`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L19" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:19</a>
</p>


### hint

```ts
hint: string
```
The useful hint to fix this issue. This should be a human readable string.
*Inherited from: `Issue.hint`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L23" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:23</a>
</p>


### receivedChecksum

```ts
receivedChecksum: string
```
The actual checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
*Inherited from: `Issue.receivedChecksum`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L31" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:31</a>
</p>


### role

```ts
role: "asset"
```
The role of the file in Minecraft.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L144" target="_blank" rel="noreferrer">packages/installer/assets.ts:144</a>
</p>


### type

```ts
type: "missing" | "corrupted"
```
The type of the issue.
*Inherited from: `Issue.type`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L11" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:11</a>
</p>


