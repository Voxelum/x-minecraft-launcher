# Interface InstallForgeOptions

The options to install forge.
## 🏷️ Properties

### checksum <Badge type="info" text="optional" />

```ts
checksum: (file: string, algorithm: string) => Promise<string>
```
Custom checksum function for file validation
*Inherited from: `LibraryOptions.checksum`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L42" target="_blank" rel="noreferrer">packages/installer/libraries.ts:42</a>
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
*Inherited from: `PostProcessOptions.executePlan`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L95" target="_blank" rel="noreferrer">packages/installer/profile.ts:95</a>
</p>


### handler <Badge type="info" text="optional" />

```ts
handler: (postProcessor: PostProcessor) => Promise<boolean>
```
Custom handlers to handle the post processor
*Inherited from: `PostProcessOptions.handler`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L86" target="_blank" rel="noreferrer">packages/installer/profile.ts:86</a>
</p>


### inheritsFrom <Badge type="info" text="optional" />

```ts
inheritsFrom: string
```
When you want to install a version over another one.

Like, you want to install liteloader over a forge version.
You should fill this with that forge version id.
*Inherited from: `InstallOptions.inheritsFrom`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L133" target="_blank" rel="noreferrer">packages/installer/utils.ts:133</a>
</p>


### java <Badge type="info" text="optional" />

```ts
java: string
```
New forge (&gt;=1.13) require java to install. Can be a executor or java executable path.
*Inherited from: `InstallProfileOption.java`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L116" target="_blank" rel="noreferrer">packages/installer/profile.ts:116</a>
</p>


### libraryHost <Badge type="info" text="optional" />

```ts
libraryHost: LibraryHost
```
A more flexiable way to control library download url.
*Inherited from: `LibraryOptions.libraryHost`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L30" target="_blank" rel="noreferrer">packages/installer/libraries.ts:30</a>
</p>


### mavenHost <Badge type="info" text="optional" />

```ts
mavenHost: string | string[]
```
The alterative maven host to download library. It will try to use these host from the ``[0]`` to the ``[maven.length - 1]``
*Inherited from: `LibraryOptions.mavenHost`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L34" target="_blank" rel="noreferrer">packages/installer/libraries.ts:34</a>
</p>


### postprocess <Badge type="info" text="optional" />

```ts
postprocess: (processor: PostProcessor[], minecraftFolder: MinecraftFolder, options: PostProcessOptions, postprocess: () => Promise<void>) => Promise<void>
```
*Inherited from: `PostProcessOptions.postprocess`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L88" target="_blank" rel="noreferrer">packages/installer/profile.ts:88</a>
</p>


### side <Badge type="info" text="optional" />

```ts
side: "server" | "client"
```
The installation side
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L129" target="_blank" rel="noreferrer">packages/installer/forge.ts:129</a>
</p>


### signal <Badge type="info" text="optional" />

```ts
signal: AbortSignal
```
*Inherited from: `LibraryOptions.signal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L46" target="_blank" rel="noreferrer">packages/installer/libraries.ts:46</a>
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


### strict <Badge type="info" text="optional" />

```ts
strict: boolean
```
*Inherited from: `LibraryOptions.strict`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L44" target="_blank" rel="noreferrer">packages/installer/libraries.ts:44</a>
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
tracker: Tracker<ForgeTrackerEvents>
```
The tracker to track the install process
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L133" target="_blank" rel="noreferrer">packages/installer/forge.ts:133</a>
</p>


### versionId <Badge type="info" text="optional" />

```ts
versionId: string
```
Override the newly installed version id.

If this is absent, the installed version id will be either generated or provided by installer.
*Inherited from: `InstallOptions.versionId`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/utils.ts#L140" target="_blank" rel="noreferrer">packages/installer/utils.ts:140</a>
</p>


