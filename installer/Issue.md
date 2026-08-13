# Interface Issue

Represent a issue for your diagnosed minecraft client.
## 🏷️ Properties

### expectedChecksum

```ts
expectedChecksum: string
```
The expected checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L27" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:27</a>
</p>


### file

```ts
file: string
```
The path of the problematic file.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L19" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:19</a>
</p>


### hint

```ts
hint: string
```
The useful hint to fix this issue. This should be a human readable string.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L23" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:23</a>
</p>


### receivedChecksum

```ts
receivedChecksum: string
```
The actual checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L31" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:31</a>
</p>


### role

```ts
role: string
```
The role of the file in Minecraft.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L15" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:15</a>
</p>


### type

```ts
type: "missing" | "corrupted"
```
The type of the issue.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L11" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:11</a>
</p>


