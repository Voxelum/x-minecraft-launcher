# Interface PostProcessOptions

## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L106" target="_blank" rel="noreferrer">packages/installer/profile.ts:106</a>
</p>


### diagnose <Badge type="info" text="optional" />

```ts
diagnose: boolean
```
*Inherited from: `WithDiagnose.diagnose`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L143" target="_blank" rel="noreferrer">packages/installer/utils.ts:143</a>
</p>


### executePlan <Badge type="info" text="optional" />

```ts
executePlan: (processors: PostProcessor[], libraries: ResolvedLibrary[], minecraftFolder: MinecraftFolder, options: PostProcessOptions) => Promise<void>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L95" target="_blank" rel="noreferrer">packages/installer/profile.ts:95</a>
</p>


### handler <Badge type="info" text="optional" />

```ts
handler: (postProcessor: PostProcessor) => Promise<boolean>
```
Custom handlers to handle the post processor
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L86" target="_blank" rel="noreferrer">packages/installer/profile.ts:86</a>
</p>


### java <Badge type="info" text="optional" />

```ts
java: string
```
The java exectable path. It will use ``java`` by default.
*Inherited from: `SpawnJavaOptions.java`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L59" target="_blank" rel="noreferrer">packages/installer/utils.ts:59</a>
</p>


### postprocess <Badge type="info" text="optional" />

```ts
postprocess: (processor: PostProcessor[], minecraftFolder: MinecraftFolder, options: PostProcessOptions, postprocess: () => Promise<void>) => Promise<void>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L88" target="_blank" rel="noreferrer">packages/installer/profile.ts:88</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L108" target="_blank" rel="noreferrer">packages/installer/profile.ts:108</a>
</p>


### spawn <Badge type="info" text="optional" />

```ts
spawn: (command: string, args?: readonly string[], options?: SpawnOptions) => ChildProcess
```
The spawn process function. Used for spawn the java process at the end.

By default, it will be the spawn function from "child_process" module. You can use this option to change the 3rd party spawn like [cross-spawn](https://www.npmjs.com/package/cross-spawn)
*Inherited from: `SpawnJavaOptions.spawn`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L66" target="_blank" rel="noreferrer">packages/installer/utils.ts:66</a>
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
tracker: Tracker<ProfileTrackerEvents>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L102" target="_blank" rel="noreferrer">packages/installer/profile.ts:102</a>
</p>


