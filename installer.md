# Installer Module

[![npm version](https://img.shields.io/npm/v/@xmcl/installer.svg)](https://www.npmjs.com/package/@xmcl/installer)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/installer.svg)](https://npmjs.com/@xmcl/installer)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/installer)](https://packagephobia.now.sh/result?p=@xmcl/installer)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide functions to install Minecraft client, libraries, and assets with smart diagnostics and efficient downloads.

## Features

- 🔍 **Diagnose-first pattern**: Checks existing files before downloading, skipping already-valid files
- 🌐 **Browser compatible**: Fetch-based APIs available for browser environments
- ⚡ **Efficient downloads**: Parallel checksum validation and downloads
- 🎯 **AbortSignal support**: Cancel ongoing operations with standard abort signals
- 📊 **Progress tracking**: Built-in tracker system for monitoring installation progress
- 🔄 **Smart resume**: Continue interrupted installations without re-downloading valid files

## Usage

### Complete Installation

Install a Minecraft version with all dependencies (jar, libraries, assets, and profiles):

```ts
import { completeInstallation } from "@xmcl/installer";
import { MinecraftLocation, ResolvedVersion, Version } from "@xmcl/core";

const minecraft: MinecraftLocation;
const version: string; // version string like 1.20.1
const resolvedVersion: ResolvedVersion = await Version.parse(minecraft, version);

// Install everything with progress tracking
await completeInstallation(resolvedVersion, {
  tracker: (event) => {
    console.log(`Phase: ${event.phase}`, event.payload);
    if ('download' in event.payload) {
      // Access download progress properties
      const { progress, total, speed } = event.payload.download;
      console.log(`Downloaded ${progress}/${total} bytes at ${speed} bytes/sec`);
    }
  }
});
```

### Install Minecraft Jar

Install just the Minecraft client or server jar:

```ts
import { installMinecraftJar } from "@xmcl/installer";

await installMinecraftJar(resolvedVersion, {
  side: 'client', // or 'server'
  tracker: (event) => {
    console.log(`Installing ${event.phase}`, event.payload);
  }
});
```

### Install Libraries

Install all required libraries:

```ts
import { installLibraries } from "@xmcl/installer";

await installLibraries(resolvedVersion, {
  tracker: (event) => {
    if (event.phase === 'libraries') {
      console.log(`Installing ${event.payload.count} libraries`);
    }
  }
});
```

### Install Assets

Install game assets:

```ts
import { installAssets } from "@xmcl/installer";

await installAssets(resolvedVersion, {
  tracker: (event) => {
    if (event.phase === 'assets.assets') {
      console.log(`Installing ${event.payload.count} assets`);
      const { progress, total } = event.payload.download;
      console.log(`Progress: ${(progress/total*100).toFixed(2)}%`);
    }
  }
});
```

### Abort Signal Support

Cancel ongoing installations using AbortSignal:

```ts
const controller = new AbortController();

// Start installation
const installPromise = completeInstallation(resolvedVersion, {
  abortSignal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await installPromise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Installation cancelled');
  }
}
```

### Diagnose Mode

Check installation status without fixing issues. When `diagnose: true` is set, `completeInstallation` will throw `InstallError` with `InstallIssue` details instead of downloading missing files:

```ts
import { completeInstallation, InstallError, type InstallIssue } from "@xmcl/installer";

try {
  await completeInstallation(resolvedVersion, {
    diagnose: true // Will throw InstallError if issues found
  });
  console.log('Installation is complete and valid');
} catch (error) {
  if (error instanceof InstallError) {
    const issue: InstallIssue = error.issue;

    // Check what's missing or corrupted
    if (issue.libraries?.length) {
      console.log(`Missing ${issue.libraries.length} libraries`);
    }
    if (issue.assets?.length) {
      console.log(`Missing ${issue.assets.length} assets`);
    }
    if (issue.jar) {
      console.log(`Bad jar: ${issue.jar}`);
    }
    if (issue.assetsIndex) {
      console.log(`Bad assets index`);
    }

    // Now install to fix the issues
    await completeInstallation(resolvedVersion);
  }
}
```

### Progress Tracking

Track installation progress with the built-in tracker system. The tracker is a function that receives event objects with `phase` and `payload` properties. For download phases, the `payload.download` object provides readonly progress information:

```ts
import type { CompleteTrackerEvents } from "@xmcl/installer";
import type { Tracker } from "@xmcl/installer";

// Tracker is a function receiving discriminated union events
const tracker: Tracker<CompleteTrackerEvents> = (event) => {
  switch (event.phase) {
    case 'version':
      console.log(`Installing version ${event.payload.id}`);
      break;
    case 'version.json':
      console.log(`Downloading version.json from ${event.payload.url}`);
      // Access readonly progress properties
      const { progress, total, speed, url } = event.payload.download;
      console.log(`${url}: ${progress}/${total} bytes (${speed} bytes/sec)`);
      break;
    case 'version.jar':
      console.log(`Downloading ${event.payload.side} jar for ${event.payload.id}`);
      const jarDownload = event.payload.download;
      console.log(`Jar: ${(jarDownload.progress/jarDownload.total*100).toFixed(1)}%`);
      break;
    case 'libraries':
      console.log(`Installing ${event.payload.count} libraries`);
      const libDownload = event.payload.download;
      console.log(`Libraries: ${(libDownload.progress/libDownload.total*100).toFixed(1)}%`);
      break;
    case 'assets':
      console.log(`Installing assets for ${event.payload.version}`);
      break;
    case 'assets.assets':
      const assetDownload = event.payload.download;
      console.log(`Assets: ${(assetDownload.progress/assetDownload.total*100).toFixed(1)}%`);
      break;
  }
};

await completeInstallation(resolvedVersion, { tracker });
```

**Download Progress Properties**: The `download` object in payloads provides these readonly properties:

- `progress: number` - Bytes downloaded so far
- `total: number` - Total bytes to download
- `speed: number` - Current download speed in bytes/sec
- `url: string` - URL(s) being downloaded
- `acceptRanges: boolean` - Whether the server supports range requests

**Tracker Event Interfaces**: Each installer function exports its own tracker event interface for type safety:

- `MinecraftTrackerEvents` - Events for `installMinecraftJar()`
- `LibrariesTrackerEvents` - Events for `installLibraries()`
- `AssetsTrackerEvents` - Events for `installAssets()`
- `ProfileTrackerEvents` - Events for profile post-processing
- `ForgeTrackerEvents` - Events for `installForge()` (extends Libraries + Profile)
- `LabyModTrackerEvents` - Events for `installLabyMod4()`
- `JavaRuntimeTrackerEvents` - Events for `installJavaRuntime()`
- `CompleteTrackerEvents` - Events for `completeInstallation()` (extends all above)

These interfaces compose and extend each other, enabling reusability and type safety.

### Customize Download Hosts

#### Library Hosts

Swap library download sources to your own or alternative Maven repositories:

```ts
await installLibraries(resolvedVersion, {
  libraryHost(library: ResolvedLibrary) {
    // Redirect specific libraries
    if (library.name === "commons-io:commons-io:2.5") {
      return "https://your-host.org/path/to/library.jar";
    }
    // Or use multiple fallback URLs
    if (library.groupId === "net.minecraftforge") {
      return [
        "https://primary-host.org/libraries",
        "https://fallback-host.org/libraries"
      ];
    }
    return undefined; // Use default
  },
  mavenHost: [
    'https://maven.aliyun.com/repository/central',
    'https://your-custom-maven.org'
  ]
});
```

#### Assets Hosts

Use custom asset servers:

```ts
await installAssets(resolvedVersion, {
  assetsHost: "https://your-cdn.com/assets"
});
```

The assets host should respond to requests like: `GET https://your-cdn.com/assets/<hash-prefix>/<hash>`
where `hash-prefix` is the first two characters of the SHA1 hash.

#### Minecraft Jar Hosts

Customize Minecraft jar download URLs:

```ts
await installMinecraftJar(resolvedVersion, {
  client: 'https://your-mirror.com/versions',
  server: (version) => `https://custom-server.com/${version.id}/server.jar`
});
```

### Browser Environment

Use browser-compatible APIs with the fetch API:

```ts
import { getVersionList, getForgeVersionList } from "@xmcl/installer/browser";

// These functions use fetch instead of undici
const versions = await getVersionList({
  fetch: window.fetch.bind(window)
});

const forgeVersions = await getForgeVersionList({
  fetch: window.fetch.bind(window)
});
```

### Download Manager (Throttler)

Customize the download behavior using the `throttler` option. The download manager controls:

- HTTP client configuration (via undici dispatcher)
- Range download policies (how files are split and downloaded in parallel)
- Checkpoint handling (for resumable downloads)
- Speed monitoring and dynamic range splitting

```ts
import { getDefaultDownloadThrottler } from "@xmcl/file-transfer";
import { Agent } from "undici";

// Create a custom download manager
const throttler = getDefaultDownloadThrottler({
  // Configure the HTTP client
  dispatcher: new Agent({
    connections: 16, // Maximum 16 concurrent connections
    pipelining: 1
  }),
  // Configure range splitting behavior
  rangePolicy: {
    rangeThreshold: 2 * 1024 * 1024, // Minimum 2MB per range
  }
});

await completeInstallation(resolvedVersion, {
  throttler
});
```

**Download Manager Features**:

- **Parallel Downloads**: Files are split into ranges and downloaded concurrently
- **Dynamic Speed Optimization**: Slow ranges are automatically subdivided for better performance
- **Resumable Downloads**: Uses checkpoint handlers to resume interrupted downloads
- **Custom Range Policies**: Implement your own `RangePolicy` to control how files are split

### Install Forge

Install Forge mod loader:

```ts
import { installForge, getForgeVersionList } from "@xmcl/installer";

// Get available Forge versions
const versionList = await getForgeVersionList();
const forgeVersion = versionList.versions.find(v => v.mcversion === '1.20.1');

// Install Forge
await installForge(forgeVersion, minecraftLocation, {
  java: '/path/to/java', // Required for Forge 1.13+
  tracker: (event) => {
    if (event.phase === 'forge.installer') {
      console.log('Downloading Forge installer');
      const { progress, total } = event.payload.download;
      console.log(`${(progress/total*100).toFixed(1)}%`);
    }
  }
});
````

Or install directly with version numbers:

```ts
await installForge({
  version: '47.2.0',
  mcversion: '1.20.1'
}, minecraftLocation);
```

**Note**: Modern Forge (1.13+) requires Java to run the installer. Ensure `java` is in your PATH or specify the path via the `java` option.

### Install Fabric

Install Fabric mod loader:

```ts
import { installFabric, getFabricLoaderArtifact } from "@xmcl/installer";

// Get Fabric loader version
const loaderArtifact = await getFabricLoaderArtifact();

// Install Fabric
await installFabric({
  minecraft: '1.20.1',
  loader: loaderArtifact.version
}, minecraftLocation);
```

### Install Quilt

Install Quilt mod loader:

```ts
import { installQuilt, getQuiltVersionList } from "@xmcl/installer";

const versionList = await getQuiltVersionList();
const quiltVersion = versionList.find(v => v.version === '0.20.2');

await installQuilt(quiltVersion, '1.20.1', minecraftLocation);
```

### Install NeoForge

Install NeoForge (the fork of Forge):

```ts
import { installNeoForge } from "@xmcl/installer";

await installNeoForge({
  version: '20.4.80',
  minecraft: '1.20.4'
}, minecraftLocation, {
  java: '/path/to/java'
});
```

### Install LabyMod

Install LabyMod client:

```ts
import { installLabyMod4, getLabyModManifest } from "@xmcl/installer";

const manifest = await getLabyModManifest({
  environment: 'production'
});

await installLabyMod4(manifest, '1.20.1', minecraftLocation, {
  tracker: (event) => {
    if (event.phase === 'labymod.assets') {
      console.log(`Installing LabyMod assets`);
    }
  }
});
```

### Install Java Runtime

Install Java runtime from Mojang's official distribution:

```ts
import { installJavaRuntimeTask } from "@xmcl/installer";
import { extractFile } from "lzma-native"; // or use 7zip-bin

await installJavaRuntimeTask({
  destination: '/path/to/java/home',
  manifest: await fetchJavaRuntimeManifest(),
  unpackLzma: async (src, dest) => {
    await extractFile(src, dest);
  }
});
```

## Advanced Features

### Diagnose Installation

Use the `diagnose` option with installation functions to check validity without fixing issues. When enabled, functions throw `InstallError` with detailed `InstallIssue` information:

```ts
import {
  completeInstallation,
  InstallError,
  type InstallIssue
} from "@xmcl/installer";

// Diagnose complete installation
try {
  await completeInstallation(resolvedVersion, { diagnose: true });
  console.log('Installation is complete and valid');
} catch (error) {
  if (error instanceof InstallError) {
    const issue: InstallIssue = error.issue;

    // Examine what needs to be fixed
    if (issue.libraries) {
      console.log(`Missing ${issue.libraries.length} libraries:`,
        issue.libraries.map(lib => lib.name));
    }
    if (issue.assets) {
      console.log(`Missing ${issue.assets.length} assets`);
    }
    if (issue.jar) {
      console.log(`Invalid jar: ${issue.jar}`);
    }
    if (issue.assetsIndex) {
      console.log(`Invalid assets index`);
    }
    if (issue.version) {
      console.log(`Invalid version: ${issue.version}`);
    }

    // Fix all issues
    await completeInstallation(resolvedVersion);
  }
}
```

**Note**: Individual install functions (`installLibraries`, `installAssets`, `installMinecraftJar`) also support the `diagnose` option.

### Smart Installation

The installer uses a diagnose-first pattern:

1. **Check existing files** with SHA1 checksums in parallel
2. **Skip valid files** to save bandwidth
3. **Download only missing/corrupted files**
4. **Support resume** for interrupted downloads

This makes reinstallations and updates much faster as it only downloads what's needed.

## 🧾 Classes

<div class="definition-grid class"><a href="installer/BadForgeInstallerJarError">BadForgeInstallerJarError</a><a href="installer/BadOptifineJarError">BadOptifineJarError</a><a href="installer/InstallError">InstallError</a><a href="installer/ParseJavaVersionError">ParseJavaVersionError</a><a href="installer/PostProcessBadJarError">PostProcessBadJarError</a><a href="installer/PostProcessFailedError">PostProcessFailedError</a><a href="installer/PostProcessNoMainClassError">PostProcessNoMainClassError</a><a href="installer/PostProcessValidationFailedError">PostProcessValidationFailedError</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="installer/AnyTracker">AnyTracker</a><a href="installer/AssetInfo">AssetInfo</a><a href="installer/AssetIssue">AssetIssue</a><a href="installer/AssetsOptions">AssetsOptions</a><a href="installer/AssetsTrackerEvents">AssetsTrackerEvents</a><a href="installer/CompleteOptions">CompleteOptions</a><a href="installer/CompleteTrackerEvents">CompleteTrackerEvents</a><a href="installer/DiagnoseOptions">DiagnoseOptions</a><a href="installer/DirectoryEntry">DirectoryEntry</a><a href="installer/DownloadInfo">DownloadInfo</a><a href="installer/Entry">Entry</a><a href="installer/FabricArtifacts">FabricArtifacts</a><a href="installer/FabricArtifactVersion">FabricArtifactVersion</a><a href="installer/FabricInstallOptions">FabricInstallOptions</a><a href="installer/FabricLoaderArtifact">FabricLoaderArtifact</a><a href="installer/FetchJavaRuntimeManifestOptions">FetchJavaRuntimeManifestOptions</a><a href="installer/FileEntry">FileEntry</a><a href="installer/ForgeInstallerEntries">ForgeInstallerEntries</a><a href="installer/ForgeTrackerEvents">ForgeTrackerEvents</a><a href="installer/ForgeVersion">ForgeVersion</a><a href="installer/ForgeVersionList">ForgeVersionList</a><a href="installer/GetQuiltOptions">GetQuiltOptions</a><a href="installer/InstallFabricVersionOptions">InstallFabricVersionOptions</a><a href="installer/InstallForgeOptions">InstallForgeOptions</a><a href="installer/InstallIssue">InstallIssue</a><a href="installer/InstallJavaRuntimeOptions">InstallJavaRuntimeOptions</a><a href="installer/InstallJavaRuntimeWithJsonOptions">InstallJavaRuntimeWithJsonOptions</a><a href="installer/InstallLabyModAddonOptions">InstallLabyModAddonOptions</a><a href="installer/InstallLabyModOptions">InstallLabyModOptions</a><a href="installer/InstallOptifineOptions">InstallOptifineOptions</a><a href="installer/InstallOptions">InstallOptions</a><a href="installer/InstallProfile">InstallProfile</a><a href="installer/InstallProfileOption">InstallProfileOption</a><a href="installer/InstallQuiltVersionOptions">InstallQuiltVersionOptions</a><a href="installer/InstallSideOption">InstallSideOption</a><a href="installer/InstallZuluJavaOptions">InstallZuluJavaOptions</a><a href="installer/Issue">Issue</a><a href="installer/JarOption">JarOption</a><a href="installer/JavaInfo">JavaInfo</a><a href="installer/JavaResolveDiagnostic">JavaResolveDiagnostic</a><a href="installer/JavaRuntimeManifest">JavaRuntimeManifest</a><a href="installer/JavaRuntimes">JavaRuntimes</a><a href="installer/JavaRuntimeTarget">JavaRuntimeTarget</a><a href="installer/JavaRuntimeTargets">JavaRuntimeTargets</a><a href="installer/JavaRuntimeTrackerEvents">JavaRuntimeTrackerEvents</a><a href="installer/LabyModAddon">LabyModAddon</a><a href="installer/LabyModAddonIndex">LabyModAddonIndex</a><a href="installer/LabyModManifest">LabyModManifest</a><a href="installer/LabyModTrackerEvents">LabyModTrackerEvents</a><a href="installer/LibrariesTrackerEvents">LibrariesTrackerEvents</a><a href="installer/LibraryOptions">LibraryOptions</a><a href="installer/LinkEntry">LinkEntry</a><a href="installer/MinecraftTrackerEvents">MinecraftTrackerEvents</a><a href="installer/MinecraftVersion">MinecraftVersion</a><a href="installer/MinecraftVersionBaseInfo">MinecraftVersionBaseInfo</a><a href="installer/MinecraftVersionList">MinecraftVersionList</a><a href="installer/OptifineTrackerEvents">OptifineTrackerEvents</a><a href="installer/PostProcessOptions">PostProcessOptions</a><a href="installer/PostProcessor">PostProcessor</a><a href="installer/ProfileTrackerEvents">ProfileTrackerEvents</a><a href="installer/QuiltLoaderArtifact">QuiltLoaderArtifact</a><a href="installer/Tracker">Tracker</a><a href="installer/ZuluJRE">ZuluJRE</a><a href="installer/ZuluTrackerEvents">ZuluTrackerEvents</a></div>

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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L473" target="_blank" rel="noreferrer">packages/installer/profile.ts:473</a>
</p>


### completeInstallation

```ts
completeInstallation(version: ResolvedVersion, options: CompleteOptions= {}): Promise<void>
```
Complete the installation of a resolved version, including minecraft jar, libraries, assets and profile.

This can continue to install an aborted or failed installation, and it can diagnose the installation if ``options.diagnose`` is set to ``true``.
#### Parameters

- **version**: `ResolvedVersion`
The resolved version to install
- **options**: `CompleteOptions`
Installation options
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installer.ts#L66" target="_blank" rel="noreferrer">packages/installer/installer.ts:66</a>
</p>


### completeInstallationByError

```ts
completeInstallationByError(version: ResolvedVersion, error: InstallError, options: CompleteOptions= {}): Promise<void>
```
#### Parameters

- **version**: `ResolvedVersion`
- **error**: `InstallError`
- **options**: `CompleteOptions`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installer.ts#L149" target="_blank" rel="noreferrer">packages/installer/installer.ts:149</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/zulu.ts#L295" target="_blank" rel="noreferrer">packages/installer/zulu.ts:295</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/diagnose.ts#L43" target="_blank" rel="noreferrer">packages/installer/diagnose.ts:43</a>
</p>


### diagnoseLibraries

```ts
diagnoseLibraries(libraries: ResolvedLibrary[], minecraft: MinecraftFolder, options: { checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; strict?: boolean }): Promise<ResolvedLibrary[]>
```
Diagnose all libraries presented in this resolved version.
#### Parameters

- **libraries**: `ResolvedLibrary[]`
The libraries to check
- **minecraft**: `MinecraftFolder`
The minecraft location
- **options**: `{ checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal; strict?: boolean }`
#### Return Type

- `Promise<ResolvedLibrary[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L167" target="_blank" rel="noreferrer">packages/installer/libraries.ts:167</a>
</p>


### diagnoseProcessorOutputs

```ts
diagnoseProcessorOutputs(processors: PostProcessor[], options: { checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal }): Promise<Issue[]>
```
Diagnose every declared output of the given processors. Returns the list of
issues found (empty when all outputs are valid).
#### Parameters

- **processors**: `PostProcessor[]`
- **options**: `{ checksum?: (file: string, algorithm: string) => Promise<string>; signal?: AbortSignal }`
#### Return Type

- `Promise<Issue[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L765" target="_blank" rel="noreferrer">packages/installer/profile.ts:765</a>
</p>


### diagnoseProfile

```ts
diagnoseProfile(installProfile: InstallProfile, minecraftLocation: MinecraftLocation, side: "server" | "client"= 'client'): Promise<boolean>
```
Diagnose a install profile status. Check if it processor output correctly processed.

This can be used for check if forge correctly installed when minecraft &gt;= 1.13
#### Parameters

- **installProfile**: `InstallProfile`
The install profile.
- **minecraftLocation**: `MinecraftLocation`
The minecraft location
- **side**: `"server" | "client"`
#### Return Type

- `Promise<boolean>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L123" target="_blank" rel="noreferrer">packages/installer/profile.ts:123</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/optifine.ts#L35" target="_blank" rel="noreferrer">packages/installer/optifine.ts:35</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L143" target="_blank" rel="noreferrer">packages/installer/java.ts:143</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L19" target="_blank" rel="noreferrer">packages/installer/fabric.ts:19</a>
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


### installAssets

```ts
installAssets(version: ResolvedVersion, options: AssetsOptions= {}): Promise<ResolvedVersion>
```
Install or check the assets to resolved version
#### Parameters

- **version**: `ResolvedVersion`
The target version
- **options**: `AssetsOptions`
The option to replace assets host url
#### Return Type

- `Promise<ResolvedVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L75" target="_blank" rel="noreferrer">packages/installer/assets.ts:75</a>
</p>


### installByProfile

```ts
installByProfile(installProfile: InstallProfile, minecraft: MinecraftLocation, options: InstallProfileOption= {}): Promise<void>
```
Install by install profile. The install profile usually contains some preprocess should run before installing dependencies.
#### Parameters

- **installProfile**: `InstallProfile`
The install profile
- **minecraft**: `MinecraftLocation`
The minecraft location
- **options**: `InstallProfileOption`
The options to install
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L257" target="_blank" rel="noreferrer">packages/installer/profile.ts:257</a>
</p>


### installFabric

```ts
installFabric(options: InstallFabricVersionOptions): Promise<string>
```
#### Parameters

- **options**: `InstallFabricVersionOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L81" target="_blank" rel="noreferrer">packages/installer/fabric.ts:81</a>
</p>


### installFabricByLoaderArtifact

```ts
installFabricByLoaderArtifact(loader: FabricLoaderArtifact, minecraft: MinecraftLocation, options: FabricInstallOptions= {}): Promise<string>
```
Install fabric version json.

If side is ``server``, it requires the Minecraft version json to be installed.
#### Parameters

- **loader**: `FabricLoaderArtifact`
- **minecraft**: `MinecraftLocation`
- **options**: `FabricInstallOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/fabric.ts#L56" target="_blank" rel="noreferrer">packages/installer/fabric.ts:56</a>
</p>


### installForge

```ts
installForge(version: RequiredVersion, minecraft: MinecraftLocation, options: InstallForgeOptions= {}): Promise<string>
```
Install forge to target location.
Installation task for forge with mcversion &gt;= 1.13 requires java installed on your pc.
#### Parameters

- **version**: `RequiredVersion`
The forge version meta
- **minecraft**: `MinecraftLocation`
- **options**: `InstallForgeOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L628" target="_blank" rel="noreferrer">packages/installer/forge.ts:628</a>
</p>


### installJavaRuntime

```ts
installJavaRuntime(options: InstallJavaRuntimeOptions): Promise<void>
```
Install java runtime from java runtime manifest
#### Parameters

- **options**: `InstallJavaRuntimeOptions`
The options to install java runtime
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L291" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:291</a>
</p>


### installJavaRuntimeWithJson

```ts
installJavaRuntimeWithJson(options: InstallJavaRuntimeWithJsonOptions): Promise<void>
```
Install java runtime from java runtime manifest
#### Parameters

- **options**: `InstallJavaRuntimeWithJsonOptions`
The options to install java runtime
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java-runtime.ts#L312" target="_blank" rel="noreferrer">packages/installer/java-runtime.ts:312</a>
</p>


### installLabyMod4

```ts
installLabyMod4(manifest: LabyModManifest, tag: string, minecraft: MinecraftLocation, options: InstallLabyModOptions= {}): Promise<string>
```
#### Parameters

- **manifest**: `LabyModManifest`
- **tag**: `string`
- **minecraft**: `MinecraftLocation`
- **options**: `InstallLabyModOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L156" target="_blank" rel="noreferrer">packages/installer/labymod.ts:156</a>
</p>


### installLabyModAddon

```ts
installLabyModAddon(namespace: string, minecraft: MinecraftLocation, options: InstallLabyModAddonOptions): Promise<string>
```
Install a LabyMod addon by namespace (like 'labyfabric' for Fabric Loader)
#### Parameters

- **namespace**: `string`
The addon namespace
- **minecraft**: `MinecraftLocation`
The Minecraft location
- **options**: `InstallLabyModAddonOptions`
Installation options
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L274" target="_blank" rel="noreferrer">packages/installer/labymod.ts:274</a>
</p>


### installLabyModFabricAddon

```ts
installLabyModFabricAddon(minecraft: MinecraftLocation, options: InstallLabyModAddonOptions): Promise<string>
```
Install Fabric Loader addon for LabyMod 4

This installs the labyfabric addon which allows running Fabric mods within LabyMod.
It will also install required dependencies like modcompat.
#### Parameters

- **minecraft**: `MinecraftLocation`
The Minecraft location
- **options**: `InstallLabyModAddonOptions`
Installation options
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L294" target="_blank" rel="noreferrer">packages/installer/labymod.ts:294</a>
</p>


### installLabyModForgeAddon

```ts
installLabyModForgeAddon(minecraft: MinecraftLocation, options: InstallLabyModAddonOptions): Promise<string>
```
Install Forge Loader addon for LabyMod 4

This installs the labyforge addon which allows running Forge mods within LabyMod.
Note: Forge Loader only supports Minecraft 1.8.9.
It will also install required dependencies like modcompat.
#### Parameters

- **minecraft**: `MinecraftLocation`
The Minecraft location
- **options**: `InstallLabyModAddonOptions`
Installation options
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L312" target="_blank" rel="noreferrer">packages/installer/labymod.ts:312</a>
</p>


### installLibraries

```ts
installLibraries(version: ResolvedVersion, options: LibraryOptions= {}): Promise<void>
```
Install all the libraries of providing version
#### Parameters

- **version**: `ResolvedVersion`
The target version
- **options**: `LibraryOptions`
The library host swap option
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L62" target="_blank" rel="noreferrer">packages/installer/libraries.ts:62</a>
</p>


### installMinecraft

```ts
installMinecraft(versionMeta: MinecraftVersionBaseInfo, minecraft: MinecraftLocation, options: JarOption= {}): Promise<ResolvedVersion>
```
Only install the json/jar. Do not install dependencies.
#### Parameters

- **versionMeta**: `MinecraftVersionBaseInfo`
the version metadata; get from updateVersionMeta
- **minecraft**: `MinecraftLocation`
minecraft location
- **options**: `JarOption`
#### Return Type

- `Promise<ResolvedVersion>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L151" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:151</a>
</p>


### installMinecraftJar

```ts
installMinecraftJar(version: ResolvedVersion, options: JarOption= {}): Promise<void>
```
#### Parameters

- **version**: `ResolvedVersion`
- **options**: `JarOption`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/minecraft.ts#L79" target="_blank" rel="noreferrer">packages/installer/minecraft.ts:79</a>
</p>


### installNeoForge

```ts
installNeoForge(project: "forge" | "neoforge", version: string, minecraft: MinecraftLocation, options: InstallForgeOptions= {}): Promise<string>
```
#### Parameters

- **project**: `"forge" | "neoforge"`
- **version**: `string`
- **minecraft**: `MinecraftLocation`
- **options**: `InstallForgeOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/neoforge.ts#L102" target="_blank" rel="noreferrer">packages/installer/neoforge.ts:102</a>
</p>


### installOptifine

```ts
installOptifine(installer: string, minecraft: MinecraftLocation, options: InstallOptifineOptions= {}): Promise<string>
```
Install optifine by optifine installer
#### Parameters

- **installer**: `string`
The installer jar file path
- **minecraft**: `MinecraftLocation`
The minecraft location
- **options**: `InstallOptifineOptions`
The option to install
 Might be changed and don't break the major version
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/optifine.ts#L78" target="_blank" rel="noreferrer">packages/installer/optifine.ts:78</a>
</p>


### installQuiltVersion

```ts
installQuiltVersion(options: InstallQuiltVersionOptions): Promise<string>
```
Install quilt version via profile API
#### Parameters

- **options**: `InstallQuiltVersionOptions`
#### Return Type

- `Promise<string>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/quilt.ts#L26" target="_blank" rel="noreferrer">packages/installer/quilt.ts:26</a>
</p>


### installResolvedAssets

```ts
installResolvedAssets(assets: AssetInfo[], folder: MinecraftFolder, version: string, options: AssetsOptions= {}): Promise<void>
```
Only install several resolved assets.
#### Parameters

- **assets**: `AssetInfo[]`
The assets to install
- **folder**: `MinecraftFolder`
The minecraft folder
- **version**: `string`
The version string for tracking
- **options**: `AssetsOptions`
The asset option
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L264" target="_blank" rel="noreferrer">packages/installer/assets.ts:264</a>
</p>


### installResolvedLibraries

```ts
installResolvedLibraries(libraries: ResolvedLibrary[], minecraft: MinecraftLocation, option: LibraryOptions= {}): Promise<void>
```
Only install several resolved libraries
#### Parameters

- **libraries**: `ResolvedLibrary[]`
The resolved libraries
- **minecraft**: `MinecraftLocation`
The minecraft location
- **option**: `LibraryOptions`
The install option
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L75" target="_blank" rel="noreferrer">packages/installer/libraries.ts:75</a>
</p>


### installZuluJava

```ts
installZuluJava(jre: ZuluJRE, options: InstallZuluJavaOptions): Promise<void>
```
Install Zulu JRE from the provided JRE information
#### Parameters

- **jre**: `ZuluJRE`
The Zulu JRE information containing download details
- **options**: `InstallZuluJavaOptions`
Installation options including destination and download settings
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/zulu.ts#L72" target="_blank" rel="noreferrer">packages/installer/zulu.ts:72</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L442" target="_blank" rel="noreferrer">packages/installer/forge.ts:442</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/labymod.ts#L326" target="_blank" rel="noreferrer">packages/installer/labymod.ts:326</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L436" target="_blank" rel="noreferrer">packages/installer/forge.ts:436</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L39" target="_blank" rel="noreferrer">packages/installer/tracker.ts:39</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L49" target="_blank" rel="noreferrer">packages/installer/tracker.ts:49</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L29" target="_blank" rel="noreferrer">packages/installer/tracker.ts:29</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L21" target="_blank" rel="noreferrer">packages/installer/tracker.ts:21</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L521" target="_blank" rel="noreferrer">packages/installer/profile.ts:521</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L84" target="_blank" rel="noreferrer">packages/installer/java.ts:84</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L64" target="_blank" rel="noreferrer">packages/installer/java.ts:64</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L147" target="_blank" rel="noreferrer">packages/installer/libraries.ts:147</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L162" target="_blank" rel="noreferrer">packages/installer/profile.ts:162</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/java.ts#L229" target="_blank" rel="noreferrer">packages/installer/java.ts:229</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/zulu.ts#L332" target="_blank" rel="noreferrer">packages/installer/zulu.ts:332</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L290" target="_blank" rel="noreferrer">packages/installer/forge.ts:290</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L453" target="_blank" rel="noreferrer">packages/installer/forge.ts:453</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/assets.ts#L33" target="_blank" rel="noreferrer">packages/installer/assets.ts:33</a>
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



## ⏩ Type Aliases

### ForgeInstallerEntriesPattern

```ts
ForgeInstallerEntriesPattern: ForgeInstallerEntries & Required<Pick<ForgeInstallerEntries, "versionJson" | "installProfileJson">>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L89" target="_blank" rel="noreferrer">packages/installer/forge.ts:89</a>
</p>


### ForgeLegacyInstallerEntriesPattern

```ts
ForgeLegacyInstallerEntriesPattern: Required<Pick<ForgeInstallerEntries, "installProfileJson" | "legacyUniversalJar">>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/forge.ts#L91" target="_blank" rel="noreferrer">packages/installer/forge.ts:91</a>
</p>


### InstallLibraryVersion

```ts
InstallLibraryVersion: Pick<ResolvedVersion, "libraries" | "minecraftDirectory">
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L55" target="_blank" rel="noreferrer">packages/installer/libraries.ts:55</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/libraries.ts#L26" target="_blank" rel="noreferrer">packages/installer/libraries.ts:26</a>
</p>


### Raw

```ts
Raw: T
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L17" target="_blank" rel="noreferrer">packages/installer/tracker.ts:17</a>
</p>


### WithDownload

```ts
WithDownload: T & { progress: ProgressTracker }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L18" target="_blank" rel="noreferrer">packages/installer/tracker.ts:18</a>
</p>


### WithProgress

```ts
WithProgress: T & { progress: { progress: number; total: number } }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L19" target="_blank" rel="noreferrer">packages/installer/tracker.ts:19</a>
</p>



