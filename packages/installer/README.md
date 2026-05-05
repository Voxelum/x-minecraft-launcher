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

````

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
