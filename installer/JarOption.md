# Interface JarOption

Replace the minecraft client or server jar download
## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L67" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:67</a>
</p>


### client <Badge type="info" text="optional" />

```ts
client: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The client jar url replacement
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L55" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:55</a>
</p>


### diagnose <Badge type="info" text="optional" />

```ts
diagnose: boolean
```
*Inherited from: `WithDiagnose.diagnose`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L143" target="_blank" rel="noreferrer">packages/installer/utils.ts:143</a>
</p>


### installJar <Badge type="info" text="optional" />

```ts
installJar: boolean
```
Whether to install the Minecraft jar after resolving the version JSON.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L47" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:47</a>
</p>


### json <Badge type="info" text="optional" />

```ts
json: string | string[] | ((version: MinecraftVersionBaseInfo) => string | string[])
```
The version json url replacement
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L51" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:51</a>
</p>


### server <Badge type="info" text="optional" />

```ts
server: string | string[] | ((version: ResolvedVersion) => string | string[])
```
The server jar url replacement
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L59" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:59</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
The installation side
*Inherited from: `InstallSideOption.side`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L76" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:76</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L69" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:69</a>
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
tracker: Tracker<MinecraftTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L63" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:63</a>
</p>


