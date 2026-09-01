# Installer Module

`@xmcl/installer` builds and executes resumable Minecraft installation workflows.

The API has three layers:

1. Domain resolvers describe Minecraft files, loader recipes, and diagnostics.
2. Workflows resolve multi-stage domain work into executable install manifests.
3. Runtimes execute domain-neutral file, Java, and filesystem tasks.

## Install Files

Pure resolvers return `InstallFile` values that can be combined into a manifest:

```ts
import { MinecraftFolder } from '@xmcl/core'
import {
  createDefaultNodeInstallRuntime,
  executeInstallManifest,
  resolveLibraryInstallFiles,
} from '@xmcl/installer'

const minecraft = MinecraftFolder.from('C:/Minecraft')
const files = resolveLibraryInstallFiles(version.libraries, minecraft, options)

await executeInstallManifest({
  schemaVersion: 1,
  tasks: [{ id: 'libraries', type: 'files', files }],
}, createDefaultNodeInstallRuntime())
```

Common file resolvers include:

- `resolveMinecraftVersionJsonInstallFile`
- `resolveMinecraftJarInstallFile`
- `resolveLibraryInstallFiles`
- `resolveAssetMetadataInstallManifest`
- `resolveAssetObjectInstallFiles`
- `resolveAssetInstallFiles`

## Install Workflows

Use an `InstallWorkflow` when later work depends on metadata or files produced by an earlier stage. A workflow is a stateful object with an asynchronous `next()` method; it is not an async generator.

```ts
import {
  createDefaultNodeInstallRuntime,
  createModernForgeInstallWorkflow,
  executeInstallWorkflow,
} from '@xmcl/installer'

const result = await executeInstallWorkflow(
  createModernForgeInstallWorkflow(options),
  createDefaultNodeInstallRuntime(),
)
```

Available workflows include:

- `createFabricInstallWorkflow`
- `createQuiltInstallWorkflow`
- `createLabyModInstallWorkflow`
- `createProfileInstallWorkflow`
- `createModernForgeInstallWorkflow`
- `createJavaRuntimeInstallWorkflow`
- `createZuluRuntimeInstallWorkflow`

`runInstallWorkflow` is the lower-level stage runner for applications that execute each generated manifest through their own service boundary.

## Manifest Tasks

An `InstallManifest` contains independent tasks connected by `dependsOn`:

- `files` validates and downloads files, retrying invalid results.
- `java` tries command strategies in order and validates their outputs.
- `materialize` applies filesystem operations transactionally and validates outputs before commit.

Materialize outputs are postconditions, not cache keys. Materialize operations run whenever their stage is reached so permissions, links, extracted layouts, and removals are restored even when an individual output file already exists.

The `ensure-directory` operation preserves an existing directory and creates it only when absent. Operations that write files already ensure their own parent directories, so workflows emit `ensure-directory` only when the directory itself is part of the required layout.

## Runtime Adapters

`createDefaultNodeInstallRuntime` uses `@xmcl/file-transfer` for downloads. Applications can replace downloading, checksums, or Java execution while retaining the standard filesystem implementation:

```ts
import {
  createNodeInstallRuntime,
  executeInstallManifest,
} from '@xmcl/installer'

const runtime = createNodeInstallRuntime({
  signal: controller.signal,
  checksum: (path, algorithm) => checksumWorker(path, algorithm),
  download: (files) => downloader.download(files),
})

await executeInstallManifest(plan, runtime)
```

The runtime contract is domain-neutral. Mirror selection, proxy handling, concurrency, progress tracking, and process execution remain application concerns.

## Domain Recipes

These APIs resolve serializable application-level recipes rather than executable task graphs:

- `resolveVersionInstallManifest`
- `resolveVersionRepairManifest`
- `resolveJavaInstallManifest`

Applications consume a recipe and use the lower-level resolvers and workflows to execute it. Java fallback metadata is resolved only when that fallback is attempted.

## Diagnostics

Diagnostics inspect an installation without mutating it:

- `diagnoseInstallation`
- `diagnoseServerInstallation`
- `diagnoseProfile`
- `diagnoseProcessorOutputs`
- `diagnoseLibraries`
- `diagnoseVersionAssets`

## Browser Entry Point

The browser entry point exposes serializable recipes, errors, and metadata helpers from the `*.browser` modules. Node filesystem executors and workflows are available only from the main entry point.
## 🧾 Classes

<div class="definition-grid class"><a href="installer/BadForgeInstallerJarError">BadForgeInstallerJarError</a><a href="installer/BadOptifineJarError">BadOptifineJarError</a><a href="installer/InstallError">InstallError</a><a href="installer/ParseJavaVersionError">ParseJavaVersionError</a><a href="installer/PostProcessBadJarError">PostProcessBadJarError</a><a href="installer/PostProcessFailedError">PostProcessFailedError</a><a href="installer/PostProcessNoMainClassError">PostProcessNoMainClassError</a><a href="installer/PostProcessValidationFailedError">PostProcessValidationFailedError</a><a href="installer/ProgressTrackerMultiple">ProgressTrackerMultiple</a><a href="installer/ProgressTrackerSingle">ProgressTrackerSingle</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="installer/AnyTracker">AnyTracker</a><a href="installer/AssetInfo">AssetInfo</a><a href="installer/AssetIssue">AssetIssue</a><a href="installer/AssetsOptions">AssetsOptions</a><a href="installer/AssetsTrackerEvents">AssetsTrackerEvents</a><a href="installer/DefaultNodeInstallRuntimeOptions">DefaultNodeInstallRuntimeOptions</a><a href="installer/DiagnoseOptions">DiagnoseOptions</a><a href="installer/DirectoryEntry">DirectoryEntry</a><a href="installer/DownloadInfo">DownloadInfo</a><a href="installer/Entry">Entry</a><a href="installer/ExecuteInstallManifestOptions">ExecuteInstallManifestOptions</a><a href="installer/ExecuteInstallWorkflowOptions">ExecuteInstallWorkflowOptions</a><a href="installer/FabricArtifacts">FabricArtifacts</a><a href="installer/FabricArtifactVersion">FabricArtifactVersion</a><a href="installer/FabricInstallOptions">FabricInstallOptions</a><a href="installer/FabricInstallWorkflowOptions">FabricInstallWorkflowOptions</a><a href="installer/FabricLoaderArtifact">FabricLoaderArtifact</a><a href="installer/FetchJavaRuntimeManifestOptions">FetchJavaRuntimeManifestOptions</a><a href="installer/FileEntry">FileEntry</a><a href="installer/ForgeInstallerEntries">ForgeInstallerEntries</a><a href="installer/ForgeProcessorResolution">ForgeProcessorResolution</a><a href="installer/ForgeTrackerEvents">ForgeTrackerEvents</a><a href="installer/ForgeVersion">ForgeVersion</a><a href="installer/ForgeVersionList">ForgeVersionList</a><a href="installer/GetQuiltOptions">GetQuiltOptions</a><a href="installer/InstallFabricVersionOptions">InstallFabricVersionOptions</a><a href="installer/InstallFile">InstallFile</a><a href="installer/InstallFileChecksum">InstallFileChecksum</a><a href="installer/InstallFilesTask">InstallFilesTask</a><a href="installer/InstallForgeOptions">InstallForgeOptions</a><a href="installer/InstallIssue">InstallIssue</a><a href="installer/InstallJavaTask">InstallJavaTask</a><a href="installer/InstallLabyModAddonOptions">InstallLabyModAddonOptions</a><a href="installer/InstallLabyModOptions">InstallLabyModOptions</a><a href="installer/InstallManifest">InstallManifest</a><a href="installer/InstallMaterializeTask">InstallMaterializeTask</a><a href="installer/InstallOptifineOptions">InstallOptifineOptions</a><a href="installer/InstallOptions">InstallOptions</a><a href="installer/InstallOutput">InstallOutput</a><a href="installer/InstallProfile">InstallProfile</a><a href="installer/InstallProfileOption">InstallProfileOption</a><a href="installer/InstallQuiltVersionOptions">InstallQuiltVersionOptions</a><a href="installer/InstallResult">InstallResult</a><a href="installer/InstallRuntime">InstallRuntime</a><a href="installer/InstallSideOption">InstallSideOption</a><a href="installer/InstallWorkflow">InstallWorkflow</a><a href="installer/InstanceVersionHeader">InstanceVersionHeader</a><a href="installer/InstanceVersionInstallLock">InstanceVersionInstallLock</a><a href="installer/InstanceVersionInstallResolver">InstanceVersionInstallResolver</a><a href="installer/InstanceVersionInstallResult">InstanceVersionInstallResult</a><a href="installer/InstanceVersionJavaPlan">InstanceVersionJavaPlan</a><a href="installer/InstanceVersionRuntime">InstanceVersionRuntime</a><a href="installer/Issue">Issue</a><a href="installer/JarOption">JarOption</a><a href="installer/JavaCommand">JavaCommand</a><a href="installer/JavaInfo">JavaInfo</a><a href="installer/JavaInstallManifest">JavaInstallManifest</a><a href="installer/JavaInstallManifestResolver">JavaInstallManifestResolver</a><a href="installer/JavaResolveDiagnostic">JavaResolveDiagnostic</a><a href="installer/JavaRuntimeInstallWorkflowOptions">JavaRuntimeInstallWorkflowOptions</a><a href="installer/JavaRuntimeManifest">JavaRuntimeManifest</a><a href="installer/JavaRuntimes">JavaRuntimes</a><a href="installer/JavaRuntimeTarget">JavaRuntimeTarget</a><a href="installer/JavaRuntimeTargets">JavaRuntimeTargets</a><a href="installer/JavaRuntimeTrackerEvents">JavaRuntimeTrackerEvents</a><a href="installer/LabyModAddon">LabyModAddon</a><a href="installer/LabyModAddonIndex">LabyModAddonIndex</a><a href="installer/LabyModManifest">LabyModManifest</a><a href="installer/LabyModTrackerEvents">LabyModTrackerEvents</a><a href="installer/LegacyForgeInstallWorkflowOptions">LegacyForgeInstallWorkflowOptions</a><a href="installer/LibrariesTrackerEvents">LibrariesTrackerEvents</a><a href="installer/LibraryOptions">LibraryOptions</a><a href="installer/LinkEntry">LinkEntry</a><a href="installer/MinecraftTrackerEvents">MinecraftTrackerEvents</a><a href="installer/MinecraftVersion">MinecraftVersion</a><a href="installer/MinecraftVersionBaseInfo">MinecraftVersionBaseInfo</a><a href="installer/MinecraftVersionList">MinecraftVersionList</a><a href="installer/ModernForgeInstallResult">ModernForgeInstallResult</a><a href="installer/ModernForgeInstallWorkflowOptions">ModernForgeInstallWorkflowOptions</a><a href="installer/NodeInstallRuntimeOptions">NodeInstallRuntimeOptions</a><a href="installer/OfficialJavaInstallCandidate">OfficialJavaInstallCandidate</a><a href="installer/OptifineTrackerEvents">OptifineTrackerEvents</a><a href="installer/PostProcessOptions">PostProcessOptions</a><a href="installer/PostProcessor">PostProcessor</a><a href="installer/ProfileInstallWorkflowOptions">ProfileInstallWorkflowOptions</a><a href="installer/ProfileTrackerEvents">ProfileTrackerEvents</a><a href="installer/ProgressTracker">ProgressTracker</a><a href="installer/QuiltInstallWorkflowOptions">QuiltInstallWorkflowOptions</a><a href="installer/QuiltLoaderArtifact">QuiltLoaderArtifact</a><a href="installer/ResolvedZuluJavaInstallCandidate">ResolvedZuluJavaInstallCandidate</a><a href="installer/ResolveInstanceVersionInstallOptions">ResolveInstanceVersionInstallOptions</a><a href="installer/ResolveJavaInstallManifestOptions">ResolveJavaInstallManifestOptions</a><a href="installer/RunInstallWorkflowOptions">RunInstallWorkflowOptions</a><a href="installer/Tracker">Tracker</a><a href="installer/VersionFreshInstallManifest">VersionFreshInstallManifest</a><a href="installer/VersionRepairManifest">VersionRepairManifest</a><a href="installer/ZuluJavaInstallCandidate">ZuluJavaInstallCandidate</a><a href="installer/ZuluJRE">ZuluJRE</a><a href="installer/ZuluRuntimeInstallWorkflowOptions">ZuluRuntimeInstallWorkflowOptions</a><a href="installer/ZuluTrackerEvents">ZuluTrackerEvents</a></div>

## 🏳️ Enums

<div class="definition-grid enum"><a href="installer/JavaRuntimeTargetType">JavaRuntimeTargetType</a></div>

## 🏭 Functions

### classpathEntryToLibraryName

```ts
classpathEntryToLibraryName(entry: string): string | undefined
```
Convert a single ``-classpath`` entry of a forge/neoforge server args file
(a path relative to the minecraft root, e.g.
``libraries/io/netty/netty-transport-native-epoll/4.2.7.Final/netty-transport-native-epoll-4.2.7.Final-linux-x86_64.jar``)
into its maven coordinate (``io.netty:netty-transport-native-epoll:4.2.7.Final:linux-x86_64``).

Unlike [convertClasspathToMaven], the FULL classifier is preserved
(that helper keeps only the first ``-``-separated segment, which would turn
``linux-x86_64`` into ``linux`` and point at a non-existent jar).
#### Parameters

- **entry**: `string`
#### Return Type

- `string | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L356" target="_blank" rel="noreferrer">packages/installer/profile.ts:356</a>
</p>


### createDefaultNodeInstallRuntime

```ts
createDefaultNodeInstallRuntime(options: DefaultNodeInstallRuntimeOptions= {}): InstallRuntime
```
#### Parameters

- **options**: `DefaultNodeInstallRuntimeOptions`
#### Return Type

- `InstallRuntime`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.default.ts#L44" target="_blank" rel="noreferrer">packages/installer/installManifest.default.ts:44</a>
</p>


### createFabricInstallWorkflow

```ts
createFabricInstallWorkflow(options: FabricInstallWorkflowOptions): InstallWorkflow<string>
```
#### Parameters

- **options**: `FabricInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L86" target="_blank" rel="noreferrer">packages/installer/fabric.ts:86</a>
</p>


### createFileTransferInstallDownload

```ts
createFileTransferInstallDownload(options: DefaultNodeInstallRuntimeOptions= {}): (files: InstallFile[]) => Promise<void>
```
#### Parameters

- **options**: `DefaultNodeInstallRuntimeOptions`
#### Return Type

- `(files: InstallFile[]) => Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.default.ts#L22" target="_blank" rel="noreferrer">packages/installer/installManifest.default.ts:22</a>
</p>


### createJavaInstallWorkflow

```ts
createJavaInstallWorkflow(candidate: ResolvedJavaInstallCandidate): InstallWorkflow<void>
```
#### Parameters

- **candidate**: `ResolvedJavaInstallCandidate`
#### Return Type

- `InstallWorkflow<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/javaInstallManifest.ts#L81" target="_blank" rel="noreferrer">packages/installer/javaInstallManifest.ts:81</a>
</p>


### createJavaRuntimeInstallWorkflow

```ts
createJavaRuntimeInstallWorkflow(options: JavaRuntimeInstallWorkflowOptions): InstallWorkflow<void>
```
#### Parameters

- **options**: `JavaRuntimeInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/javaWorkflow.ts#L40" target="_blank" rel="noreferrer">packages/installer/javaWorkflow.ts:40</a>
</p>


### createLabyModInstallWorkflow

```ts
createLabyModInstallWorkflow(manifest: LabyModManifest, tag: string, folder: MinecraftFolder, environment: string= 'production'): InstallWorkflow<string>
```
#### Parameters

- **manifest**: `LabyModManifest`
- **tag**: `string`
- **folder**: `MinecraftFolder`
- **environment**: `string`
#### Return Type

- `InstallWorkflow<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L59" target="_blank" rel="noreferrer">packages/installer/labymod.ts:59</a>
</p>


### createLegacyForgeInstallWorkflow

```ts
createLegacyForgeInstallWorkflow(options: LegacyForgeInstallWorkflowOptions): InstallWorkflow<string>
```
#### Parameters

- **options**: `LegacyForgeInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L322" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:322</a>
</p>


### createModernForgeInstallWorkflow

```ts
createModernForgeInstallWorkflow(options: ModernForgeInstallWorkflowOptions): InstallWorkflow<ModernForgeInstallResult>
```
#### Parameters

- **options**: `ModernForgeInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<ModernForgeInstallResult>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L158" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:158</a>
</p>


### createNodeInstallRuntime

```ts
createNodeInstallRuntime(options: NodeInstallRuntimeOptions= {}): InstallRuntime
```
#### Parameters

- **options**: `NodeInstallRuntimeOptions`
#### Return Type

- `InstallRuntime`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L507" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:507</a>
</p>


### createProfileInstallWorkflow

```ts
createProfileInstallWorkflow(options: ProfileInstallWorkflowOptions): InstallWorkflow<string>
```
#### Parameters

- **options**: `ProfileInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forgeWorkflow.ts#L69" target="_blank" rel="noreferrer">packages/installer/forgeWorkflow.ts:69</a>
</p>


### createQuiltInstallWorkflow

```ts
createQuiltInstallWorkflow(options: QuiltInstallWorkflowOptions): InstallWorkflow<string>
```
#### Parameters

- **options**: `QuiltInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L27" target="_blank" rel="noreferrer">packages/installer/quilt.ts:27</a>
</p>


### createZuluRuntimeInstallWorkflow

```ts
createZuluRuntimeInstallWorkflow(options: ZuluRuntimeInstallWorkflowOptions): InstallWorkflow<void>
```
#### Parameters

- **options**: `ZuluRuntimeInstallWorkflowOptions`
#### Return Type

- `InstallWorkflow<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/javaWorkflow.ts#L128" target="_blank" rel="noreferrer">packages/installer/javaWorkflow.ts:128</a>
</p>


### detectLibc

```ts
detectLibc(platform: string= process.platform): "musl" | "glibc"
```
Detect whether the current Linux host uses the musl C library (Alpine and
similar) rather than glibc. A musl-linked JRE only runs on musl systems and
a glibc-linked JRE only runs on glibc systems; picking the wrong one makes
the ``java`` binary fail to ``exec`` with ``ENOENT`` (its dynamic loader, e.g.
``/lib/ld-musl-x86-64.so.1``, is absent). See the launch ``launchInvalidJavaPath``
failures reported by users on non-musl distros.

Uses the Node.js diagnostic report: glibc builds expose
``header.glibcVersionRuntime``, musl builds do not (and their loaded shared
objects reference ``ld-musl``/``libc.musl``).
#### Parameters

- **platform**: `string`
#### Return Type

- `"musl" | "glibc"`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/zulu.ts#L53" target="_blank" rel="noreferrer">packages/installer/zulu.ts:53</a>
</p>


### diagnoseAssets

```ts
diagnoseAssets(assetObjects: AssetInfo[], minecraft: MinecraftFolder, options: DiagnoseOptions): Promise<{ hash: string; name: string; size: number }[]>
```
Diagnose assets currently installed.
#### Parameters

- **assetObjects**: `AssetInfo[]`
The assets object metadata to check
- **minecraft**: `MinecraftFolder`
The minecraft location
- **options**: `DiagnoseOptions`
#### Return Type

- `Promise<{ hash: string; name: string; size: number }[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L157" target="_blank" rel="noreferrer">packages/installer/assets.ts:157</a>
</p>


### diagnoseFile

```ts
diagnoseFile(__namedParameters: { algorithm?: string; expectedChecksum: string; file: string; hint: string; role: T }, options: DiagnoseOptions): Promise<Issue | undefined>
```
Diagnose a single file by a certain checksum algorithm. By default, this use sha1
#### Parameters

- **__namedParameters**: `{ algorithm?: string; expectedChecksum: string; file: string; hint: string; role: T }`
- **options**: `DiagnoseOptions`
#### Return Type

- `Promise<Issue | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L48" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:48</a>
</p>


### diagnoseInstallation

```ts
diagnoseInstallation(version: ResolvedVersion, options: DiagnoseOptions= {}): Promise<InstallIssue | undefined>
```
#### Parameters

- **version**: `ResolvedVersion`
- **options**: `DiagnoseOptions`
#### Return Type

- `Promise<InstallIssue | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installer.ts#L49" target="_blank" rel="noreferrer">packages/installer/installer.ts:49</a>
</p>


### diagnoseLibraries

```ts
diagnoseLibraries(libraries: ResolvedLibrary[], minecraft: MinecraftFolder, options: { checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; strict?: boolean; timestamp?: number }): Promise<ResolvedLibrary[]>
```
Diagnose all libraries presented in this resolved version.
#### Parameters

- **libraries**: `ResolvedLibrary[]`
The libraries to check
- **minecraft**: `MinecraftFolder`
The minecraft location
- **options**: `{ checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; strict?: boolean; timestamp?: number }`
#### Return Type

- `Promise<ResolvedLibrary[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L105" target="_blank" rel="noreferrer">packages/installer/libraries.ts:105</a>
</p>


### diagnoseProcessorOutputs

```ts
diagnoseProcessorOutputs(processors: PostProcessor[], options: { checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; timestamp?: number }): Promise<Issue[]>
```
Diagnose every declared output of the given processors. Returns the list of
issues found (empty when all outputs are valid).
#### Parameters

- **processors**: `PostProcessor[]`
- **options**: `{ checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; timestamp?: number }`
#### Return Type

- `Promise<Issue[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L611" target="_blank" rel="noreferrer">packages/installer/profile.ts:611</a>
</p>


### diagnoseProfile

```ts
diagnoseProfile(installProfile: InstallProfile, minecraftLocation: MinecraftLocation, side: "server" | "client"= 'client', options: { checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; timestamp?: number }): Promise<boolean>
```
Diagnose a install profile status. Check if it processor output correctly processed.

This can be used for check if forge correctly installed when minecraft &gt;= 1.13
#### Parameters

- **installProfile**: `InstallProfile`
The install profile.
- **minecraftLocation**: `MinecraftLocation`
The minecraft location
- **side**: `"server" | "client"`
- **options**: `{ checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; timestamp?: number }`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L132" target="_blank" rel="noreferrer">packages/installer/profile.ts:132</a>
</p>


### diagnoseServerInstallation

```ts
diagnoseServerInstallation(version: ResolvedServerVersion, minecraft: MinecraftFolder, baseVersion: ResolvedVersion, options: DiagnoseOptions= {}): Promise<InstallIssue | undefined>
```
#### Parameters

- **version**: `ResolvedServerVersion`
- **minecraft**: `MinecraftFolder`
- **baseVersion**: `ResolvedVersion`
- **options**: `DiagnoseOptions`
#### Return Type

- `Promise<InstallIssue | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installer.ts#L82" target="_blank" rel="noreferrer">packages/installer/installer.ts:82</a>
</p>


### diagnoseVersionAssets

```ts
diagnoseVersionAssets(version: ResolvedVersion, options: DiagnoseOptions & Pick<AssetsOptions, "useHashForAssetsIndex">= {}): Promise<{ assets?: AssetInfo[]; assetsIndex?: AssetIndex } | undefined>
```
#### Parameters

- **version**: `ResolvedVersion`
- **options**: `DiagnoseOptions & Pick<AssetsOptions, "useHashForAssetsIndex">`
#### Return Type

- `Promise<{ assets?: AssetInfo[]; assetsIndex?: AssetIndex } | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L207" target="_blank" rel="noreferrer">packages/installer/assets.ts:207</a>
</p>


### executeInstallManifest

```ts
executeInstallManifest(plan: InstallManifest, runtime: InstallRuntime, options: ExecuteInstallManifestOptions= {}): Promise<InstallResult>
```
#### Parameters

- **plan**: `InstallManifest`
- **runtime**: `InstallRuntime`
- **options**: `ExecuteInstallManifestOptions`
#### Return Type

- `Promise<InstallResult>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L292" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:292</a>
</p>


### executeInstallWorkflow

```ts
executeInstallWorkflow(workflow: InstallWorkflow<T>, runtime: InstallRuntime, options: ExecuteInstallWorkflowOptions= {}): Promise<T>
```
#### Parameters

- **workflow**: `InstallWorkflow<T>`
- **runtime**: `InstallRuntime`
- **options**: `ExecuteInstallWorkflowOptions`
#### Return Type

- `Promise<T>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L369" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:369</a>
</p>


### fetchJavaRuntimeManifest

```ts
fetchJavaRuntimeManifest(options: FetchJavaRuntimeManifestOptions= {}): Promise<JavaRuntimeManifest>
```
Fetch java runtime manifest. It should be able to resolve to your platform, or you can assign the platform.

Also, you should assign the target to download, or it will use the latest java 16.
#### Parameters

- **options**: `FetchJavaRuntimeManifestOptions`
The options of fetch runtime manifest
#### Return Type

- `Promise<JavaRuntimeManifest>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L191" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:191</a>
</p>


### generateOptifineVersion

```ts
generateOptifineVersion(editionRelease: string, minecraftVersion: string, launchWrapperVersion: string, options: InstallOptifineOptions= {}): Version
```
Generate the optifine version json from provided info.
#### Parameters

- **editionRelease**: `string`
The edition + release with _
- **minecraftVersion**: `string`
The minecraft version
- **launchWrapperVersion**: `string`
The launch wrapper version
- **options**: `InstallOptifineOptions`
The install options
 Might be changed and don't break the major version
#### Return Type

- `Version`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/optifine.ts#L39" target="_blank" rel="noreferrer">packages/installer/optifine.ts:39</a>
</p>


### getFabricGames

```ts
getFabricGames(options: FetchOptions): Promise<string[]>
```
Get supported fabric game versions
#### Parameters

- **options**: `FetchOptions`
#### Return Type

- `Promise<string[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.browser.ts#L39" target="_blank" rel="noreferrer">packages/installer/fabric.browser.ts:39</a>
</p>


### getFabricLoaderArtifact

```ts
getFabricLoaderArtifact(minecraft: string, loader: string, options: FetchOptions): Promise<FabricLoaderArtifact>
```
Get fabric-loader artifact list by Minecraft version
#### Parameters

- **minecraft**: `string`
The minecraft version
- **loader**: `string`
The yarn-loader version
- **options**: `FetchOptions`
#### Return Type

- `Promise<FabricLoaderArtifact>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.browser.ts#L74" target="_blank" rel="noreferrer">packages/installer/fabric.browser.ts:74</a>
</p>


### getFabricLoaders

```ts
getFabricLoaders(options: FetchOptions): Promise<FabricArtifactVersion[]>
```
Get fabric-loader artifact list
#### Parameters

- **options**: `FetchOptions`
#### Return Type

- `Promise<FabricArtifactVersion[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.browser.ts#L48" target="_blank" rel="noreferrer">packages/installer/fabric.browser.ts:48</a>
</p>


### getForgeVersionList

```ts
getForgeVersionList(options: FetchOptions & { minecraft?: string }= {}): Promise<ForgeVersionList>
```
Query the webpage content from files.minecraftforge.net.

You can put the last query result to the fallback option. It will check if your old result is up-to-date.
It will request a new page only when the fallback option is outdated.
#### Parameters

- **options**: `FetchOptions & { minecraft?: string }`
#### Return Type

- `Promise<ForgeVersionList>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.browser.ts#L62" target="_blank" rel="noreferrer">packages/installer/forge.browser.ts:62</a>
</p>


### getLabyModAddon

```ts
getLabyModAddon(namespace: string, env: string= 'production', options: FetchOptions): Promise<LabyModAddon>
```
Get detailed information about a specific LabyMod addon
#### Parameters

- **namespace**: `string`
The addon namespace (e.g., 'labyfabric', 'modcompat')
- **env**: `string`
The environment (production, beta, etc.)
- **options**: `FetchOptions`
Request options
#### Return Type

- `Promise<LabyModAddon>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.browser.ts#L130" target="_blank" rel="noreferrer">packages/installer/labymod.browser.ts:130</a>
</p>


### getLabyModAddonIndex

```ts
getLabyModAddonIndex(env: string= 'production', options: FetchOptions): Promise<LabyModAddonIndex[]>
```
Get the LabyMod addon index from Flint store
#### Parameters

- **env**: `string`
The environment (production, beta, etc.)
- **options**: `FetchOptions`
Request options
#### Return Type

- `Promise<LabyModAddonIndex[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.browser.ts#L114" target="_blank" rel="noreferrer">packages/installer/labymod.browser.ts:114</a>
</p>


### getLabyModManifest

```ts
getLabyModManifest(env: string= 'production', options: FetchOptions): Promise<LabyModManifest>
```
#### Parameters

- **env**: `string`
- **options**: `FetchOptions`
#### Return Type

- `Promise<LabyModManifest>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.browser.ts#L99" target="_blank" rel="noreferrer">packages/installer/labymod.browser.ts:99</a>
</p>


### getLoaderArtifactListFor

```ts
getLoaderArtifactListFor(minecraft: string, options: FetchOptions): Promise<FabricLoaderArtifact[]>
```
Get fabric-loader artifact list by Minecraft version
#### Parameters

- **minecraft**: `string`
The minecraft version
- **options**: `FetchOptions`
#### Return Type

- `Promise<FabricLoaderArtifact[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.browser.ts#L58" target="_blank" rel="noreferrer">packages/installer/fabric.browser.ts:58</a>
</p>


### getPotentialJavaLocations

```ts
getPotentialJavaLocations(): Promise<string[]>
```
Get all potential java locations for Minecraft.

On mac/linux, it will perform ``which java``. On win32, it will perform ``where java``
#### Return Type

- `Promise<string[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L161" target="_blank" rel="noreferrer">packages/installer/java.ts:161</a>
</p>


### getQuiltGames

```ts
getQuiltGames(options: FetchOptions): Promise<string[]>
```
Get supported quilt game versions
#### Parameters

- **options**: `FetchOptions`
#### Return Type

- `Promise<string[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.browser.ts#L17" target="_blank" rel="noreferrer">packages/installer/quilt.browser.ts:17</a>
</p>


### getQuiltLoaders

```ts
getQuiltLoaders(options: FetchOptions): Promise<FabricArtifactVersion[]>
```
Get quilt-loader artifact list
#### Parameters

- **options**: `FetchOptions`
#### Return Type

- `Promise<FabricArtifactVersion[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.browser.ts#L26" target="_blank" rel="noreferrer">packages/installer/quilt.browser.ts:26</a>
</p>


### getQuiltLoaderVersionsByMinecraft

```ts
getQuiltLoaderVersionsByMinecraft(options: GetQuiltOptions): Promise<QuiltLoaderArtifact[]>
```
Get quilt loader versions list for a specific minecraft version
#### Parameters

- **options**: `GetQuiltOptions`
#### Return Type

- `Promise<QuiltLoaderArtifact[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.browser.ts#L35" target="_blank" rel="noreferrer">packages/installer/quilt.browser.ts:35</a>
</p>


### getVersionJsonFromLoaderArtifact

```ts
getVersionJsonFromLoaderArtifact(loader: FabricLoaderArtifact, side: "server" | "client", options: FabricInstallOptions= {}): { arguments: { game: never[]; jvm: never[] }; id: string; inheritsFrom: string; libraries: { name: string; url: string }[]; mainClass: string; releaseTime: string; time: string }
```
Generate fabric version json from loader artifact.
#### Parameters

- **loader**: `FabricLoaderArtifact`
The fabric loader artifact
- **side**: `"server" | "client"`
The side of the fabric
- **options**: `FabricInstallOptions`

#### Return Type

- `{ arguments: { game: never[]; jvm: never[] }; id: string; inheritsFrom: string; libraries: { name: string; url: string }[]; mainClass: string; releaseTime: string; time: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L20" target="_blank" rel="noreferrer">packages/installer/fabric.ts:20</a>
</p>


### getVersionList

```ts
getVersionList(options: FetchOptions & { remote?: string }= {}): Promise<MinecraftVersionList>
```
Get and update the version list.
This try to send http GET request to offical Minecraft metadata endpoint by default.
You can swap the endpoint by passing url on ``remote`` in option.
#### Parameters

- **options**: `FetchOptions & { remote?: string }`
#### Return Type

- `Promise<MinecraftVersionList>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.browser.ts#L64" target="_blank" rel="noreferrer">packages/installer/minecraft.browser.ts:64</a>
</p>


### isEmptyOrCorruptArchive

```ts
isEmptyOrCorruptArchive(file: string, signal: AbortSignal): Promise<boolean>
```
Detect whether a jar/zip file is unreadable or contains zero entries.

The forge/neoforge ``binarypatcher`` processor can silently emit a 22-byte
empty zip when its lzma input is corrupt. That passes a naive ``size > 0``
check but leaves the game running against unpatched vanilla classes, which
crashes at bootstrap.
#### Parameters

- **file**: `string`
- **signal**: `AbortSignal`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L543" target="_blank" rel="noreferrer">packages/installer/profile.ts:543</a>
</p>


### isForgeInstallerEntries

```ts
isForgeInstallerEntries(entries: ForgeInstallerEntries): entries is ForgeInstallerEntriesPattern
```
#### Parameters

- **entries**: `ForgeInstallerEntries`
#### Return Type

- `entries is ForgeInstallerEntriesPattern`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L433" target="_blank" rel="noreferrer">packages/installer/forge.ts:433</a>
</p>


### isInstallError

```ts
isInstallError(e: any): e is InstallError
```
#### Parameters

- **e**: `any`
#### Return Type

- `e is InstallError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L72" target="_blank" rel="noreferrer">packages/installer/error.ts:72</a>
</p>


### isLabyModAddonCompatible

```ts
isLabyModAddonCompatible(addon: LabyModAddon | LabyModAddonIndex, minecraftVersion: string): boolean
```
Check if a LabyMod addon supports a specific Minecraft version
#### Parameters

- **addon**: `LabyModAddon | LabyModAddonIndex`
The addon to check
- **minecraftVersion**: `string`
The Minecraft version to check (e.g., '1.20.1', '1.21')
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L260" target="_blank" rel="noreferrer">packages/installer/labymod.ts:260</a>
</p>


### isLegacyForgeInstallerEntries

```ts
isLegacyForgeInstallerEntries(entries: ForgeInstallerEntries): entries is Required<Pick<ForgeInstallerEntries, "installProfileJson" | "legacyUniversalJar">>
```
#### Parameters

- **entries**: `ForgeInstallerEntries`
#### Return Type

- `entries is Required<Pick<ForgeInstallerEntries, "installProfileJson" | "legacyUniversalJar">>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L427" target="_blank" rel="noreferrer">packages/installer/forge.ts:427</a>
</p>


### mergeInstallIssue

```ts
mergeInstallIssue(target: InstallIssue, source: InstallIssue): InstallIssue
```
#### Parameters

- **target**: `InstallIssue`
- **source**: `InstallIssue`
#### Return Type

- `InstallIssue`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/error.ts#L47" target="_blank" rel="noreferrer">packages/installer/error.ts:47</a>
</p>


### onDownloadMultiple

```ts
onDownloadMultiple(tracker: Tracker<T> | undefined, phase: K, payload: Omit<T[K], "progress">): ProgressTrackerMultiple
```
#### Parameters

- **tracker**: `Tracker<T> | undefined`
- **phase**: `K`
- **payload**: `Omit<T[K], "progress">`
#### Return Type

- `ProgressTrackerMultiple`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L77" target="_blank" rel="noreferrer">packages/installer/tracker.ts:77</a>
</p>


### onDownloadSingle

```ts
onDownloadSingle(tracker: Tracker<T> | undefined, phase: K, payload: Omit<T[K], "progress">): ProgressTrackerSingle
```
#### Parameters

- **tracker**: `Tracker<T> | undefined`
- **phase**: `K`
- **payload**: `Omit<T[K], "progress">`
#### Return Type

- `ProgressTrackerSingle`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L87" target="_blank" rel="noreferrer">packages/installer/tracker.ts:87</a>
</p>


### onProgress

```ts
onProgress(tracker: Tracker<T> | undefined, phase: K, payload: Omit<T[K], "progress">): { progress: number; total: number }
```
#### Parameters

- **tracker**: `Tracker<T> | undefined`
- **phase**: `K`
- **payload**: `Omit<T[K], "progress">`
#### Return Type

- `{ progress: number; total: number }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L67" target="_blank" rel="noreferrer">packages/installer/tracker.ts:67</a>
</p>


### onState

```ts
onState(tracker: Tracker<T> | undefined, phase: K, payload: T[K]): void
```
#### Parameters

- **tracker**: `Tracker<T> | undefined`
- **phase**: `K`
- **payload**: `T[K]`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L59" target="_blank" rel="noreferrer">packages/installer/tracker.ts:59</a>
</p>


### parseArgumentsFromArgsFile

```ts
parseArgumentsFromArgsFile(content: string, parentDir: string, serverProfile: Version): string | undefined
```
Parse a forge server ``win_args.txt`` / ``unix_args.txt`` file.

The file has the shape ``[jvm options...] (-jar <jar> | <main-class>) [game
args...]``. The jvm options are collected verbatim, the terminator is either a
``-jar <jar>`` pair or a bare main-class token, and everything after it is a
game argument.
#### Parameters

- **content**: `string`
- **parentDir**: `string`
- **serverProfile**: `Version`
#### Return Type

- `string | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L404" target="_blank" rel="noreferrer">packages/installer/profile.ts:404</a>
</p>


### parseJavaVersion

```ts
parseJavaVersion(versionText: string): { majorVersion: number; patch: number; version: string } | undefined
```
Parse version string and major version number from ``java -version`` output.
#### Parameters

- **versionText**: `string`
The stdout or stderr for ``java -version``
#### Return Type

- `{ majorVersion: number; patch: number; version: string } | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L102" target="_blank" rel="noreferrer">packages/installer/java.ts:102</a>
</p>


### parseJavaVersionOutput

```ts
parseJavaVersionOutput(stdout: string, stderr: string): { majorVersion: number; patch: number; version: string } | undefined
```
#### Parameters

- **stdout**: `string`
- **stderr**: `string`
#### Return Type

- `{ majorVersion: number; patch: number; version: string } | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L71" target="_blank" rel="noreferrer">packages/installer/java.ts:71</a>
</p>


### resolveAssetInstallFiles

```ts
resolveAssetInstallFiles(assets: AssetInfo[], folder: MinecraftFolder, options: AssetsOptions= {}): InstallFile[]
```
#### Parameters

- **assets**: `AssetInfo[]`
- **folder**: `MinecraftFolder`
- **options**: `AssetsOptions`
#### Return Type

- `InstallFile[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L244" target="_blank" rel="noreferrer">packages/installer/assets.ts:244</a>
</p>


### resolveAssetMetadataInstallFiles

```ts
resolveAssetMetadataInstallFiles(version: ResolvedVersion, folder: MinecraftFolder, options: AssetsOptions= {}): InstallFile[]
```
#### Parameters

- **version**: `ResolvedVersion`
- **folder**: `MinecraftFolder`
- **options**: `AssetsOptions`
#### Return Type

- `InstallFile[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L60" target="_blank" rel="noreferrer">packages/installer/assets.ts:60</a>
</p>


### resolveAssetMetadataInstallManifest

```ts
resolveAssetMetadataInstallManifest(version: ResolvedVersion, folder: MinecraftFolder, options: AssetsOptions= {}): InstallManifest
```
#### Parameters

- **version**: `ResolvedVersion`
- **folder**: `MinecraftFolder`
- **options**: `AssetsOptions`
#### Return Type

- `InstallManifest`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L95" target="_blank" rel="noreferrer">packages/installer/assets.ts:95</a>
</p>


### resolveAssetObjectInstallFiles

```ts
resolveAssetObjectInstallFiles(version: ResolvedVersion, folder: MinecraftFolder, options: AssetsOptions= {}): Promise<InstallFile[]>
```
#### Parameters

- **version**: `ResolvedVersion`
- **folder**: `MinecraftFolder`
- **options**: `AssetsOptions`
#### Return Type

- `Promise<InstallFile[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L119" target="_blank" rel="noreferrer">packages/installer/assets.ts:119</a>
</p>


### resolveFabricInstallManifest

```ts
resolveFabricInstallManifest(options: InstallFabricVersionOptions): Promise<{ plan: InstallManifest; version: string }>
```
#### Parameters

- **options**: `InstallFabricVersionOptions`
#### Return Type

- `Promise<{ plan: InstallManifest; version: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L136" target="_blank" rel="noreferrer">packages/installer/fabric.ts:136</a>
</p>


### resolveFabricLoaderArtifactPlan

```ts
resolveFabricLoaderArtifactPlan(loader: FabricLoaderArtifact, minecraft: MinecraftLocation, options: FabricInstallOptions= {}): { plan: InstallManifest; version: string }
```
#### Parameters

- **loader**: `FabricLoaderArtifact`
- **minecraft**: `MinecraftLocation`
- **options**: `FabricInstallOptions`
#### Return Type

- `{ plan: InstallManifest; version: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L50" target="_blank" rel="noreferrer">packages/installer/fabric.ts:50</a>
</p>


### resolveFabricProfileInstallManifest

```ts
resolveFabricProfileInstallManifest(content: Version, options: InstallFabricVersionOptions): { plan: InstallManifest; version: string }
```
#### Parameters

- **content**: `Version`
- **options**: `InstallFabricVersionOptions`
#### Return Type

- `{ plan: InstallManifest; version: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L150" target="_blank" rel="noreferrer">packages/installer/fabric.ts:150</a>
</p>


### resolveForgeArtifactVersion

```ts
resolveForgeArtifactVersion(minecraft: string, forge: string): string
```
#### Parameters

- **minecraft**: `string`
- **forge**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L572" target="_blank" rel="noreferrer">packages/installer/forge.ts:572</a>
</p>


### resolveForgeInstallerFile

```ts
resolveForgeInstallerFile(forgeVersion: string, installer: { path: string; sha1?: string } | undefined, minecraft: MinecraftFolder, options: InstallForgeOptions, legacy: boolean): { file: InstallFile; source: string }
```
#### Parameters

- **forgeVersion**: `string`
- **installer**: `{ path: string; sha1?: string } | undefined`
- **minecraft**: `MinecraftFolder`
- **options**: `InstallForgeOptions`
- **legacy**: `boolean`
#### Return Type

- `{ file: InstallFile; source: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L515" target="_blank" rel="noreferrer">packages/installer/forge.ts:515</a>
</p>


### resolveForgeInstallerMaterialization

```ts
resolveForgeInstallerMaterialization(zip: ZipFile, entries: ForgeInstallerEntriesPattern, inputProfile: InstallProfile, mc: MinecraftFolder, jarPath: string, options: Pick<InstallForgeOptions, "versionId" | "inheritsFrom">): Promise<{ profile: InstallProfile; task: InstallMaterializeTask; version: string }>
```
#### Parameters

- **zip**: `ZipFile`
- **entries**: `ForgeInstallerEntriesPattern`
- **inputProfile**: `InstallProfile`
- **mc**: `MinecraftFolder`
- **jarPath**: `string`
- **options**: `Pick<InstallForgeOptions, "versionId" | "inheritsFrom">`
#### Return Type

- `Promise<{ profile: InstallProfile; task: InstallMaterializeTask; version: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L173" target="_blank" rel="noreferrer">packages/installer/forge.ts:173</a>
</p>


### resolveJava

```ts
resolveJava(path: string): Promise<JavaInfo | undefined>
```
Try to resolve a java info at this path. This will call ``java -version``
#### Parameters

- **path**: `string`
The java exectuable path.
#### Return Type

- `Promise<JavaInfo | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L34" target="_blank" rel="noreferrer">packages/installer/java.ts:34</a>
</p>


### resolveJavaInstallManifest

```ts
resolveJavaInstallManifest(options: ResolveJavaInstallManifestOptions, resolver: JavaInstallManifestResolver): Promise<JavaInstallManifest>
```
#### Parameters

- **options**: `ResolveJavaInstallManifestOptions`
- **resolver**: `JavaInstallManifestResolver`
#### Return Type

- `Promise<JavaInstallManifest>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/javaInstallManifest.ts#L52" target="_blank" rel="noreferrer">packages/installer/javaInstallManifest.ts:52</a>
</p>


### resolveJavaWithDiagnostic

```ts
resolveJavaWithDiagnostic(path: string): Promise<JavaResolveDiagnostic>
```
Resolve Java while retaining the process output for callers that need to
diagnose why an existing, executable runtime could not be recognized.
#### Parameters

- **path**: `string`
#### Return Type

- `Promise<JavaResolveDiagnostic>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L42" target="_blank" rel="noreferrer">packages/installer/java.ts:42</a>
</p>


### resolveLabyModInstallManifest

```ts
resolveLabyModInstallManifest(manifest: LabyModManifest, tag: string, folder: MinecraftFolder, environment: string, options: InstallLabyModOptions): Promise<{ plan: InstallManifest; version: string }>
```
#### Parameters

- **manifest**: `LabyModManifest`
- **tag**: `string`
- **folder**: `MinecraftFolder`
- **environment**: `string`
- **options**: `InstallLabyModOptions`
#### Return Type

- `Promise<{ plan: InstallManifest; version: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L129" target="_blank" rel="noreferrer">packages/installer/labymod.ts:129</a>
</p>


### resolveLabyModMetadataInstallManifest

```ts
resolveLabyModMetadataInstallManifest(manifest: LabyModManifest, tag: string, folder: MinecraftFolder, environment: string, libraries: LabyModLibraryInfo[], sourceVersionJson: any): { plan: InstallManifest; version: string }
```
#### Parameters

- **manifest**: `LabyModManifest`
- **tag**: `string`
- **folder**: `MinecraftFolder`
- **environment**: `string`
- **libraries**: `LabyModLibraryInfo[]`
- **sourceVersionJson**: `any`
#### Return Type

- `{ plan: InstallManifest; version: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L189" target="_blank" rel="noreferrer">packages/installer/labymod.ts:189</a>
</p>


### resolveLegacyForgeInstallerMaterialization

```ts
resolveLegacyForgeInstallerMaterialization(entries: ForgeLegacyInstallerEntriesPattern, inputProfile: InstallProfile, mc: MinecraftFolder, jarPath: string, options: Pick<InstallForgeOptions, "versionId" | "inheritsFrom">): { profile: InstallProfile; task: InstallMaterializeTask; version: string }
```
#### Parameters

- **entries**: `ForgeLegacyInstallerEntriesPattern`
- **inputProfile**: `InstallProfile`
- **mc**: `MinecraftFolder`
- **jarPath**: `string`
- **options**: `Pick<InstallForgeOptions, "versionId" | "inheritsFrom">`
#### Return Type

- `{ profile: InstallProfile; task: InstallMaterializeTask; version: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L309" target="_blank" rel="noreferrer">packages/installer/forge.ts:309</a>
</p>


### resolveLegacyForgeUniversalMaterialization

```ts
resolveLegacyForgeUniversalMaterialization(universalArchive: string, mc: MinecraftFolder, forgeVersion: string, minecraftVersion: string): { task: InstallMaterializeTask; version: string }
```
#### Parameters

- **universalArchive**: `string`
- **mc**: `MinecraftFolder`
- **forgeVersion**: `string`
- **minecraftVersion**: `string`
#### Return Type

- `{ task: InstallMaterializeTask; version: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L358" target="_blank" rel="noreferrer">packages/installer/forge.ts:358</a>
</p>


### resolveLibraryDownloadUrls

```ts
resolveLibraryDownloadUrls(library: ResolvedLibrary, libraryOptions: LibraryOptions): string[]
```
Resolve a library download urls with fallback.
#### Parameters

- **library**: `ResolvedLibrary`
The resolved library
- **libraryOptions**: `LibraryOptions`
The library install options
#### Return Type

- `string[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L85" target="_blank" rel="noreferrer">packages/installer/libraries.ts:85</a>
</p>


### resolveLibraryInstallFiles

```ts
resolveLibraryInstallFiles(libraries: ResolvedLibrary[], minecraft: MinecraftFolder, options: LibraryOptions= {}): InstallFile[]
```
#### Parameters

- **libraries**: `ResolvedLibrary[]`
- **minecraft**: `MinecraftFolder`
- **options**: `LibraryOptions`
#### Return Type

- `InstallFile[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L51" target="_blank" rel="noreferrer">packages/installer/libraries.ts:51</a>
</p>


### resolveMinecraftJarInstallFile

```ts
resolveMinecraftJarInstallFile(version: ResolvedVersion, options: JarOption= {}): InstallFile | undefined
```
#### Parameters

- **version**: `ResolvedVersion`
- **options**: `JarOption`
#### Return Type

- `InstallFile | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L79" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:79</a>
</p>


### resolveMinecraftVersionJsonInstallFile

```ts
resolveMinecraftVersionJsonInstallFile(version: MinecraftVersionBaseInfo, minecraft: MinecraftLocation, options: JarOption= {}): InstallFile
```
#### Parameters

- **version**: `MinecraftVersionBaseInfo`
- **minecraft**: `MinecraftLocation`
- **options**: `JarOption`
#### Return Type

- `InstallFile`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L99" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:99</a>
</p>


### resolveNeoForgedInstallerFile

```ts
resolveNeoForgedInstallerFile(project: "forge" | "neoforge", version: string, minecraft: MinecraftFolder, options: InstallForgeOptions): Promise<{ file: InstallFile; source: string }>
```
#### Parameters

- **project**: `"forge" | "neoforge"`
- **version**: `string`
- **minecraft**: `MinecraftFolder`
- **options**: `InstallForgeOptions`
#### Return Type

- `Promise<{ file: InstallFile; source: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/neoforge.ts#L38" target="_blank" rel="noreferrer">packages/installer/neoforge.ts:38</a>
</p>


### resolveOptifineInstallManifest

```ts
resolveOptifineInstallManifest(installer: string, minecraft: MinecraftLocation, options: InstallOptifineOptions= {}): Promise<{ plan: InstallManifest; version: string }>
```
#### Parameters

- **installer**: `string`
- **minecraft**: `MinecraftLocation`
- **options**: `InstallOptifineOptions`
#### Return Type

- `Promise<{ plan: InstallManifest; version: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/optifine.ts#L73" target="_blank" rel="noreferrer">packages/installer/optifine.ts:73</a>
</p>


### resolvePostProcessJavaTask

```ts
resolvePostProcessJavaTask(options: { batch?: { classpath: string; cwd?: string; javaArgs?: string[] }; dependsOn?: string[]; id: string; java: string; javaArgs?: string[]; metadata?: Record<string, string | number | boolean>; minecraft: MinecraftLocation; processors: PostProcessor[] }): Promise<InstallJavaTask>
```
#### Parameters

- **options**: `{ batch?: { classpath: string; cwd?: string; javaArgs?: string[] }; dependsOn?: string[]; id: string; java: string; javaArgs?: string[]; metadata?: Record<string, string | number | boolean>; minecraft: MinecraftLocation; processors: PostProcessor[] }`
#### Return Type

- `Promise<InstallJavaTask>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L262" target="_blank" rel="noreferrer">packages/installer/profile.ts:262</a>
</p>


### resolveProcessors

```ts
resolveProcessors(side: "server" | "client", installProfile: InstallProfile, minecraft: MinecraftFolder): { args: string[]; classpath: string[]; jar: string; outputs: { [key: string]: string }; sides?: ("server" | "client")[] }[]
```
Resolve processors in install profile
#### Parameters

- **side**: `"server" | "client"`
- **installProfile**: `InstallProfile`
- **minecraft**: `MinecraftFolder`
#### Return Type

- `{ args: string[]; classpath: string[]; jar: string; outputs: { [key: string]: string }; sides?: ("server" | "client")[] }[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L175" target="_blank" rel="noreferrer">packages/installer/profile.ts:175</a>
</p>


### resolveQuiltInstallManifest

```ts
resolveQuiltInstallManifest(options: InstallQuiltVersionOptions): Promise<{ plan: InstallManifest; version: string }>
```
#### Parameters

- **options**: `InstallQuiltVersionOptions`
#### Return Type

- `Promise<{ plan: InstallManifest; version: string }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L77" target="_blank" rel="noreferrer">packages/installer/quilt.ts:77</a>
</p>


### resolveQuiltProfileInstallManifest

```ts
resolveQuiltProfileInstallManifest(content: Version, options: InstallQuiltVersionOptions): { plan: InstallManifest; version: string }
```
#### Parameters

- **content**: `Version`
- **options**: `InstallQuiltVersionOptions`
#### Return Type

- `{ plan: InstallManifest; version: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L91" target="_blank" rel="noreferrer">packages/installer/quilt.ts:91</a>
</p>


### resolveVersionInstallManifest

```ts
resolveVersionInstallManifest(options: ResolveInstanceVersionInstallOptions, resolver: InstanceVersionInstallResolver): Promise<VersionInstallManifest>
```
#### Parameters

- **options**: `ResolveInstanceVersionInstallOptions`
- **resolver**: `InstanceVersionInstallResolver`
#### Return Type

- `Promise<VersionInstallManifest>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L195" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:195</a>
</p>


### resolveVersionRepairManifest

```ts
resolveVersionRepairManifest(options: ResolveInstanceVersionInstallOptions & { resolvedVersion: string }): VersionRepairManifest
```
#### Parameters

- **options**: `ResolveInstanceVersionInstallOptions & { resolvedVersion: string }`
#### Return Type

- `VersionRepairManifest`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L184" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:184</a>
</p>


### runInstallWorkflow

```ts
runInstallWorkflow(workflow: InstallWorkflow<T>, execute: (plan: InstallManifest, stage: number) => Promise<void>, options: RunInstallWorkflowOptions= {}): Promise<T>
```
#### Parameters

- **workflow**: `InstallWorkflow<T>`
- **execute**: `(plan: InstallManifest, stage: number) => Promise<void>`
- **options**: `RunInstallWorkflowOptions`
#### Return Type

- `Promise<T>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L381" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:381</a>
</p>


### scanLocalJava

```ts
scanLocalJava(locations: string[]): Promise<JavaInfo[]>
```
Scan local java version on the disk.

It will check if the passed ``locations`` are the home of java.
Notice that the locations should not be the executable, but the path of java installation, like JAVA_HOME.

This will call ``getPotentialJavaLocations`` and then ``resolveJava``
#### Parameters

- **locations**: `string[]`
The location (like java_home) want to check.
#### Return Type

- `Promise<JavaInfo[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L227" target="_blank" rel="noreferrer">packages/installer/java.ts:227</a>
</p>


### selectZuluJRE

```ts
selectZuluJRE(jres: ZuluJRE[], platform: string= process.platform, arch: string= process.arch, libc: "musl" | "glibc"= ...): ZuluJRE | undefined
```
Select the best Zulu JRE from an array of options based on current platform and preferences
#### Parameters

- **jres**: `ZuluJRE[]`
Array of available Zulu JRE options
- **platform**: `string`
Target platform (defaults to current platform)
- **arch**: `string`
Target architecture (defaults to current architecture)
- **libc**: `"musl" | "glibc"`
Target C library on Linux (defaults to auto-detecting the host)
#### Return Type

- `ZuluJRE | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/zulu.ts#L90" target="_blank" rel="noreferrer">packages/installer/zulu.ts:90</a>
</p>


### unpackForgeInstaller

```ts
unpackForgeInstaller(zip: ZipFile, entries: ForgeInstallerEntriesPattern, profile: InstallProfile, mc: MinecraftFolder, jarPath: string, options: InstallForgeOptions): Promise<string>
```
Unpack forge installer jar file content to the version library artifact directory.
#### Parameters

- **zip**: `ZipFile`
The forge jar file
- **entries**: `ForgeInstallerEntriesPattern`
The entries
- **profile**: `InstallProfile`
The forge install profile
- **mc**: `MinecraftFolder`
The minecraft location
- **jarPath**: `string`
- **options**: `InstallForgeOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L148" target="_blank" rel="noreferrer">packages/installer/forge.ts:148</a>
</p>


### walkForgeInstallerEntries

```ts
walkForgeInstallerEntries(zip: ZipFile, forgeVersion: string): Promise<ForgeInstallerEntries>
```
Walk the forge installer file to find key entries
#### Parameters

- **zip**: `ZipFile`
THe forge instal
- **forgeVersion**: `string`
Forge version to install
#### Return Type

- `Promise<ForgeInstallerEntries>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L444" target="_blank" rel="noreferrer">packages/installer/forge.ts:444</a>
</p>



## 🏷️ Variables

### DEFAULT_FORGE_MAVEN <Badge type="tip" text="const" />

```ts
DEFAULT_FORGE_MAVEN: "https://maven.minecraftforge.net" = 'https://maven.minecraftforge.net'
```
The official Forge maven host.

Forge moved off the legacy ``http://files.minecraftforge.net/maven`` host;
newer Minecraft versions (1.21+ etc.) only publish their installer jars
to ``https://maven.minecraftforge.net``. The old URL continues to redirect
for archival files but does not serve recent releases.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.browser.ts#L52" target="_blank" rel="noreferrer">packages/installer/forge.browser.ts:52</a>
</p>


### DEFAULT_META_URL_FABRIC <Badge type="tip" text="const" />

```ts
DEFAULT_META_URL_FABRIC: "https://meta.fabricmc.net" = 'https://meta.fabricmc.net'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.browser.ts#L3" target="_blank" rel="noreferrer">packages/installer/fabric.browser.ts:3</a>
</p>


### DEFAULT_META_URL_QUILT <Badge type="tip" text="const" />

```ts
DEFAULT_META_URL_QUILT: "https://meta.quiltmc.org" = 'https://meta.quiltmc.org'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.browser.ts#L4" target="_blank" rel="noreferrer">packages/installer/quilt.browser.ts:4</a>
</p>


### DEFAULT_RESOURCE_ROOT_URL <Badge type="tip" text="const" />

```ts
DEFAULT_RESOURCE_ROOT_URL: "https://resources.download.minecraft.net" = 'https://resources.download.minecraft.net'
```
Default resource/assets url root
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L24" target="_blank" rel="noreferrer">packages/installer/assets.ts:24</a>
</p>


### DEFAULT_RUNTIME_ALL_URL <Badge type="tip" text="const" />

```ts
DEFAULT_RUNTIME_ALL_URL: "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json" = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L131" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:131</a>
</p>


### DEFAULT_VERSION_MANIFEST_URL <Badge type="tip" text="const" />

```ts
DEFAULT_VERSION_MANIFEST_URL: "https://launchermeta.mojang.com/mc/game/version_manifest.json" = 'https://launchermeta.mojang.com/mc/game/version_manifest.json'
```
Default minecraft version manifest url.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.browser.ts#L54" target="_blank" rel="noreferrer">packages/installer/minecraft.browser.ts:54</a>
</p>


### POST_PROCESS_BATCH_PROTOCOL <Badge type="tip" text="const" />

```ts
POST_PROCESS_BATCH_PROTOCOL: "isolated-classloader-v1" = 'isolated-classloader-v1'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L38" target="_blank" rel="noreferrer">packages/installer/profile.ts:38</a>
</p>



## ⏩ Type Aliases

### ForgeInstallerEntriesPattern

```ts
ForgeInstallerEntriesPattern: ForgeInstallerEntries & Required<Pick<ForgeInstallerEntries, "versionJson" | "installProfileJson">>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L91" target="_blank" rel="noreferrer">packages/installer/forge.ts:91</a>
</p>


### ForgeLegacyInstallerEntriesPattern

```ts
ForgeLegacyInstallerEntriesPattern: Required<Pick<ForgeInstallerEntries, "installProfileJson" | "legacyUniversalJar">>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L93" target="_blank" rel="noreferrer">packages/installer/forge.ts:93</a>
</p>


### InstallEvent

```ts
InstallEvent: { at: number; task: InstallTask; type: "task-start" } | { at: number; duration: number; error?: unknown; task: InstallTask; type: "task-end" } | { attempt: number; delay: number; error?: unknown; pending: number; task: InstallFilesTask; type: "file-retry" } | { strategy: number; task: InstallJavaTask; type: "java-strategy-start" } | { error: unknown; strategy: number; task: InstallJavaTask; type: "java-strategy-failed" }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L115" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:115</a>
</p>


### InstallLibraryVersion

```ts
InstallLibraryVersion: Pick<ResolvedVersion, "libraries" | "minecraftDirectory">
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L49" target="_blank" rel="noreferrer">packages/installer/libraries.ts:49</a>
</p>


### InstallMaterializeOperation

```ts
InstallMaterializeOperation: { content: string; encoding?: "utf8" | "base64"; path: string; type: "write" } | { path: string; type: "ensure-directory" } | { mode: number; path: string; type: "chmod" } | { path: string; source: string; type: "copy" } | { path: string; source: string; type: "link" } | { path: string; type: "remove" } | { archive: string; entry: string; path: string; type: "extract" } | { archives: string[]; excludePrefixes?: string[]; path: string; type: "merge-zip" } | { archive: string; format: "zip" | "tar.gz"; path: string; stripComponents?: number; type: "extract-archive" }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L63" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:63</a>
</p>


### InstallPlanStep

```ts
InstallPlanStep: { done: false; plan: InstallManifest } | { done: true; result: T }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L139" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:139</a>
</p>


### InstallTask

```ts
InstallTask: InstallFilesTask | InstallJavaTask | InstallMaterializeTask
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L88" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:88</a>
</p>


### InstanceVersionLayer

```ts
InstanceVersionLayer: { role: "labymod" | "forge" | "neoforge" | "fabric" | "quilt" | "optifine"; type: "use"; version: string } | { manifest: LabyModManifest; type: "labymod" } | { installer?: { path: string; sha1?: string }; type: "forge"; version: string } | { type: "neoforge"; version: string } | { loader: string; type: "fabric" } | { loader: string; type: "quilt" } | { type: "optifine"; version: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L26" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:26</a>
</p>


### JavaInstallCandidate

```ts
JavaInstallCandidate: OfficialJavaInstallCandidate | ZuluJavaInstallCandidate
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/javaInstallManifest.ts#L24" target="_blank" rel="noreferrer">packages/installer/javaInstallManifest.ts:24</a>
</p>


### JreRuntimeEntry

```ts
JreRuntimeEntry: FileEntry | DirectoryEntry | LinkEntry
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.browser.ts#L116" target="_blank" rel="noreferrer">packages/installer/java-runtime.browser.ts:116</a>
</p>


### LibraryHost

```ts
LibraryHost: (library: ResolvedLibrary) => string | string[] | undefined
```
The function to swap library host.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L20" target="_blank" rel="noreferrer">packages/installer/libraries.ts:20</a>
</p>


### Raw

```ts
Raw: T
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L55" target="_blank" rel="noreferrer">packages/installer/tracker.ts:55</a>
</p>


### ResolvedJavaInstallCandidate

```ts
ResolvedJavaInstallCandidate: OfficialJavaInstallCandidate | ResolvedZuluJavaInstallCandidate
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/javaInstallManifest.ts#L30" target="_blank" rel="noreferrer">packages/installer/javaInstallManifest.ts:30</a>
</p>


### VersionInstallManifest

```ts
VersionInstallManifest: VersionFreshInstallManifest | VersionRepairManifest
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/versionInstallManifest.ts#L54" target="_blank" rel="noreferrer">packages/installer/versionInstallManifest.ts:54</a>
</p>


### WithDownload

```ts
WithDownload: T & { progress: ProgressTracker }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L56" target="_blank" rel="noreferrer">packages/installer/tracker.ts:56</a>
</p>


### WithProgress

```ts
WithProgress: T & { progress: { progress: number; total: number } }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L57" target="_blank" rel="noreferrer">packages/installer/tracker.ts:57</a>
</p>



