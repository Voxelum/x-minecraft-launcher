# Launcher Core Module

[![npm version](https://img.shields.io/npm/v/@xmcl/core.svg)](https://www.npmjs.com/package/@xmcl/core)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/core.svg)](https://npmjs.com/@xmcl/core)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/core)](https://packagephobia.now.sh/result?p=@xmcl/core)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide the core function to parse Minecraft version and launch.

## Usage

### Parse Version JSON

Parse minecraft version as a resolved version, which is used for launching process. You can also read version info from it if you want.

```ts
import { Version } from "@xmcl/core";
const minecraftLocation: string;
const minecraftVersionId: string;

const resolvedVersion: ResolvedVersion = await Version.parse(minecraftLocation, minecraftVersionId);
```

### Launch Game

Launch minecraft from a version:

```ts
import { launch } from "@xmcl/core"
const version: string; // full version id, like 1.13, or your forge version like, 1.13-forge-<someForgeVersion>
const javaPath: string; // java executable path
const gamePath: string; // .minecraft path
const proc: Promise<ChildProcess> = launch({ gamePath, javaPath, version });
```

Detach from the parent process. So your launcher's exit/crash won't affact the Minecraft running.

```ts
const proc: Promise<ChildProcess> = Launcher.launch({ gamePath, javaPath, version, extraExecOption: { detached: true } });
```

#### Launching with Server Connection

For newer Minecraft versions, use the `quickPlayMultiplayer` option to directly connect to a server:

```ts
import { launch, createQuickPlayMultiplayer } from "@xmcl/core"

// Option 1: Use quickPlayMultiplayer directly
const proc = launch({
  gamePath,
  javaPath,
  version,
  quickPlayMultiplayer: 'play.hypixel.net:25565'
});

// Option 2: Use helper function
const proc = launch({
  gamePath,
  javaPath,
  version,
  quickPlayMultiplayer: createQuickPlayMultiplayer('mc.example.com', 8080)
});
```

For backward compatibility, the legacy `server` option is still supported:

```ts
// Legacy server option (still works)
const proc = launch({
  gamePath,
  javaPath,
  version,
  server: { ip: 'play.hypixel.net', port: 25565 }
});
```

Both `quickPlayMultiplayer` and `server` options can be used together for compatibility:

```ts
// Both options together for compatibility
const proc = launch({
  gamePath,
  javaPath,
  version,
  quickPlayMultiplayer: 'play.hypixel.net:25565',
  server: { ip: 'play.hypixel.net', port: 25565 }
});
```

## 🧾 Classes

<div class="definition-grid class"><a href="core/MinecraftFolder">MinecraftFolder</a><a href="core/ResolvedLibrary">ResolvedLibrary</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="core/BadVersionJsonError">BadVersionJsonError</a><a href="core/BaseServerOptions">BaseServerOptions</a><a href="core/CircularDependenciesError">CircularDependenciesError</a><a href="core/CorruptedVersionJarError">CorruptedVersionJarError</a><a href="core/CorruptedVersionJsonError">CorruptedVersionJsonError</a><a href="core/EnabledFeatures">EnabledFeatures</a><a href="core/JavaVersion">JavaVersion</a><a href="core/LaunchOption">LaunchOption</a><a href="core/LaunchPrecheck">LaunchPrecheck</a><a href="core/LibraryInfo">LibraryInfo</a><a href="core/MinecraftProcessWatcher">MinecraftProcessWatcher</a><a href="core/MissingLibrariesError">MissingLibrariesError</a><a href="core/MissingVersionJsonError">MissingVersionJsonError</a><a href="core/Platform">Platform</a><a href="core/ResolvedServerVersion">ResolvedServerVersion</a><a href="core/ResolvedVersion">ResolvedVersion</a><a href="core/ServerOptions">ServerOptions</a><a href="core/Version">Version</a><a href="core/VersionDirective">VersionDirective</a><a href="core/VersionHeader">VersionHeader</a></div>

## 🗃️ Namespaces

<div class="definition-grid namespace"><a href="core/LaunchPrecheck">LaunchPrecheck</a><a href="core/LibraryInfo">LibraryInfo</a><a href="core/MinecraftPath">MinecraftPath</a><a href="core/Version">Version</a></div>

## 🏭 Functions

### createMinecraftProcessWatcher

```ts
createMinecraftProcessWatcher(process: ChildProcess, emitter: EventEmitter= ...): MinecraftProcessWatcher
```
Create a process watcher for a minecraft process.

It will watch the stdout and the error event of the process to detect error and minecraft state.
#### Parameters

- **process**: `ChildProcess`
The Minecraft process
- **emitter**: `EventEmitter`
The event emitter which will emit usefule event
#### Return Type

- `MinecraftProcessWatcher`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L601" target="_blank" rel="noreferrer">packages/core/launch.ts:601</a>
</p>


### createQuickPlayMultiplayer

```ts
createQuickPlayMultiplayer(ip: string, port: number): string
```
Create a quickPlayMultiplayer string from server IP and optional port
#### Parameters

- **ip**: `string`
The server IP address
- **port**: `number`
The server port (optional, defaults to 25565 if not specified)
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L1004" target="_blank" rel="noreferrer">packages/core/launch.ts:1004</a>
</p>


### findLabyModVersion

```ts
findLabyModVersion(resolvedVersion: ResolvedVersion): string
```
#### Parameters

- **resolvedVersion**: `ResolvedVersion`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L89" target="_blank" rel="noreferrer">packages/core/header.ts:89</a>
</p>


### findNeoforgeVersion

```ts
findNeoforgeVersion(minecraft: string, resolvedVersion: { arguments: { game: LaunchArgument[]; jvm: LaunchArgument[] }; libraries: LibraryInfo[] }): string
```
#### Parameters

- **minecraft**: `string`
- **resolvedVersion**: `{ arguments: { game: LaunchArgument[]; jvm: LaunchArgument[] }; libraries: LibraryInfo[] }`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L39" target="_blank" rel="noreferrer">packages/core/header.ts:39</a>
</p>


### generateArguments

```ts
generateArguments(options: LaunchOption): Promise<string[]>
```
Generate the arguments array by options. This function is useful if you want to launch the process by yourself.

This function will **NOT** check if the runtime libs are completed, and **WONT'T** check or extract native libs.

If you want to ensure native. Please see [LaunchPrecheck.checkNatives](#LaunchPrecheck.checkNatives).
#### Parameters

- **options**: `LaunchOption`
The launch options.
#### Return Type

- `Promise<string[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L770" target="_blank" rel="noreferrer">packages/core/launch.ts:770</a>
</p>


### generateArgumentsServer

```ts
generateArgumentsServer(options: ServerOptions, _delimiter: string= delimiter, _sep: string= sep): string[]
```
Generate the argument for server
#### Parameters

- **options**: `ServerOptions`
- **_delimiter**: `string`
- **_sep**: `string`
#### Return Type

- `string[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L717" target="_blank" rel="noreferrer">packages/core/launch.ts:717</a>
</p>


### getPlatform

```ts
getPlatform(): Platform
```
Get Minecraft style platform info. (Majorly used to enable/disable native dependencies)
#### Return Type

- `Platform`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/platform.ts#L24" target="_blank" rel="noreferrer">packages/core/platform.ts:24</a>
</p>


### getResolvedVersionHeader

```ts
getResolvedVersionHeader(ver: ResolvedVersion): VersionHeader
```
#### Parameters

- **ver**: `ResolvedVersion`
#### Return Type

- `VersionHeader`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L96" target="_blank" rel="noreferrer">packages/core/header.ts:96</a>
</p>


### isBadVersionJsonError

```ts
isBadVersionJsonError(e: any): e is BadVersionJsonError
```
#### Parameters

- **e**: `any`
#### Return Type

- `e is BadVersionJsonError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L133" target="_blank" rel="noreferrer">packages/core/version.ts:133</a>
</p>


### isCorruptedVersionJsonError

```ts
isCorruptedVersionJsonError(e: any): e is CorruptedVersionJsonError
```
#### Parameters

- **e**: `any`
#### Return Type

- `e is CorruptedVersionJsonError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L141" target="_blank" rel="noreferrer">packages/core/version.ts:141</a>
</p>


### isFabricLoaderLibrary

```ts
isFabricLoaderLibrary(lib: LibraryInfo): boolean
```
#### Parameters

- **lib**: `LibraryInfo`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L78" target="_blank" rel="noreferrer">packages/core/header.ts:78</a>
</p>


### isForgeLibrary

```ts
isForgeLibrary(lib: LibraryInfo): boolean
```
#### Parameters

- **lib**: `LibraryInfo`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L70" target="_blank" rel="noreferrer">packages/core/header.ts:70</a>
</p>


### isMissingVersionJsonError

```ts
isMissingVersionJsonError(e: any): e is MissingVersionJsonError
```
#### Parameters

- **e**: `any`
#### Return Type

- `e is MissingVersionJsonError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L149" target="_blank" rel="noreferrer">packages/core/version.ts:149</a>
</p>


### isOptifineLibrary

```ts
isOptifineLibrary(lib: LibraryInfo): boolean
```
#### Parameters

- **lib**: `LibraryInfo`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L81" target="_blank" rel="noreferrer">packages/core/header.ts:81</a>
</p>


### isQuiltLibrary

```ts
isQuiltLibrary(lib: LibraryInfo): boolean
```
#### Parameters

- **lib**: `LibraryInfo`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L86" target="_blank" rel="noreferrer">packages/core/header.ts:86</a>
</p>


### isSameForgeVersion

```ts
isSameForgeVersion(forgeVersion: string, version: string, minecraft: string): boolean
```
#### Parameters

- **forgeVersion**: `string`
- **version**: `string`
- **minecraft**: `string`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L111" target="_blank" rel="noreferrer">packages/core/header.ts:111</a>
</p>


### launch

```ts
launch(options: LaunchOption): Promise<ChildProcess>
```
Launch the minecraft as a child process. This function use spawn to create child process. To use an alternative way, see function generateArguments.

By default, it will use the ``LauncherPrecheck.Default`` to pre-check:
- It will also check if the runtime libs are completed, and will extract native libs if needed.
- It might throw exception when the version jar is missing/checksum not matched.
- It might throw if the libraries/natives are missing.

If you DON'T want such precheck, and you want to change it. You can assign the ``prechecks`` property in launch

````ts
launch({ ...otherOptions, prechecks: yourPrechecks });
````
#### Parameters

- **options**: `LaunchOption`
The detail options for this launching.
#### Return Type

- `Promise<ChildProcess>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L675" target="_blank" rel="noreferrer">packages/core/launch.ts:675</a>
</p>


### launchServer

```ts
launchServer(options: ServerOptions): Promise<ChildProcess>
```
#### Parameters

- **options**: `ServerOptions`
#### Return Type

- `Promise<ChildProcess>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L539" target="_blank" rel="noreferrer">packages/core/launch.ts:539</a>
</p>


### matchVersion

```ts
matchVersion(versions: VersionHeader[], id: string, runtime: VersionDirective): VersionHeader | undefined
```
#### Parameters

- **versions**: `VersionHeader[]`
- **id**: `string`
- **runtime**: `VersionDirective`
#### Return Type

- `VersionHeader | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L132" target="_blank" rel="noreferrer">packages/core/header.ts:132</a>
</p>


### parseForgeVersion

```ts
parseForgeVersion(forgeVersion: string): string
```
#### Parameters

- **forgeVersion**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L60" target="_blank" rel="noreferrer">packages/core/header.ts:60</a>
</p>


### parseOptifineVersion

```ts
parseOptifineVersion(optifineVersion: string): string
```
#### Parameters

- **optifineVersion**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/header.ts#L65" target="_blank" rel="noreferrer">packages/core/header.ts:65</a>
</p>



## 🏷️ Variables

### DEFAULT_EXTRA_JVM_ARGS <Badge type="tip" text="const" />

```ts
DEFAULT_EXTRA_JVM_ARGS: readonly string[] = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/launch.ts#L23" target="_blank" rel="noreferrer">packages/core/launch.ts:23</a>
</p>



## ⏩ Type Aliases

### MinecraftLocation

```ts
MinecraftLocation: MinecraftFolder | string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/folder.ts#L183" target="_blank" rel="noreferrer">packages/core/folder.ts:183</a>
</p>


### VersionParseError

```ts
VersionParseError: (BadVersionJsonError | CorruptedVersionJsonError | MissingVersionJsonError | CircularDependenciesError) & Error | Error
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/core/version.ts#L163" target="_blank" rel="noreferrer">packages/core/version.ts:163</a>
</p>



