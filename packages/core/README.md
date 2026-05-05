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
