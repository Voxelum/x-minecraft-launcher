# Interface InstallFile

## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: InstallFileChecksum
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L22" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:22</a>
</p>


### path

```ts
path: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L19" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:19</a>
</p>


### replace <Badge type="info" text="optional" />

```ts
replace: boolean
```
Replace the existing file before trusting any cached validation state.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L27" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:27</a>
</p>


### size <Badge type="info" text="optional" />

```ts
size: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L21" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:21</a>
</p>


### trustExistingSize <Badge type="info" text="optional" />

```ts
trustExistingSize: boolean
```
Trust an existing file with the expected size, but still checksum newly downloaded content.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L25" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:25</a>
</p>


### urls

```ts
urls: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L20" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:20</a>
</p>


### validatedAt <Badge type="info" text="optional" />

```ts
validatedAt: number
```
Last timestamp at which this exact file was known to be valid.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L29" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:29</a>
</p>


### validator <Badge type="info" text="optional" />

```ts
validator: "json" | "file" | "zip"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L23" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:23</a>
</p>


