# Mod Parser

[![npm version](https://img.shields.io/npm/v/@xmcl/mod-parser.svg)](https://www.npmjs.com/package/@xmcl/mod-parser)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/mod-parser.svg)](https://npmjs.com/@xmcl/mod-parser)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/mod-parser)](https://packagephobia.now.sh/result?p=@xmcl/mod-parser)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

## Usage

### Parse Fabric Mod Metadata

```ts
import { readFabricMod, FabricModMetadata } from "@xmcl/mods";
const modJarBinary = fs.readFileSync("your-fabric.jar");
const metadata: FabricModMetadata = await readFabricMod(modJarBinary);

// or directly read from path
const sameMetadata: FabricModMetadata = await readFabricMod("your-fabric.jar");
```

### Parse Forge Mod/Config

Read the forge mod metadata, including `@Mod` annotation, mcmods.info, and toml metadata.

```ts
import { readForgeMod, ForgeModMetadata } from "@xmcl/mods";
const forgeModJarBuff: Buffer;
const metadata: ForgeModMetadata[] = await readForgeMod(forgeModJarBuff);
const modid = metadata[0].modid; // get modid of first mods
```

If you don't want to read that much (as it will transverse all the file in jar), you can try to use them separately:

```ts
import { resolveFileSystem } from "@xmcl/system";
import { readForgeModJson, readForgeModManifest, readForgeModToml, ForgeModMetadata, readForgeModAsm } from "@xmcl/mods";
const forgeModJarBuff: Buffer;
const fs = await resolveFileSystem(forgeModJarBuff);
// read json
// if this is new mod, this will be empty record {}
const metadata: Record<string, ForgeModMetadata> = await readForgeModJson(fs);
// or read `META-INF/MANIFEST.MF`
const manifest: Record<string, string> = await readForgeModManifest(fs, metadata /* this is optional, to fill the modmetadata if found */);
// read new toml
await readForgeModToml(fs, metadata /* it will fill mods into this param & return it */, manifest /* this is optional */);
// optional step, if the mod is really unstandard, not have mcmod.info and toml, you can use this
// this can identify optifine and in some case, might detect some coremod
// this will go over all file in your jar, it might hit your perf.
await readForgeModAsm(fs, metadata, { manifest });
```

Read the forge mod config file (.cfg)

```ts
import { ForgeConfig } from "@xmcl/mods";
const modConfigString: string;
const config: ForgeConfig = ForgeConfig.parse(modConfigString);
const serializedBack: string = ForgeConfig.stringify(config);
```

### Parse Liteloader Mod

Read .litemod metadata:

```ts
import { LiteloaderModMetadata, readLiteloaderMod } from "@xmcl/mods";
const metadata: LiteloaderModMetadata = await readLiteloaderMod(`${mock}/mods/sample-mod.litemod`);
```
