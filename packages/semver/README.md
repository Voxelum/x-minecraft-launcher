# Fabric Semetic Version Module

[![npm version](https://img.shields.io/npm/v/@xmcl/semver.svg)](https://www.npmjs.com/package/@xmcl/semver)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/semver.svg)](https://npmjs.com/@xmcl/semver)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/semver)](https://packagephobia.now.sh/result?p=@xmcl/semver)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Port the fabric special [sementic version algorithm](https://github.com/FabricMC/fabric-loader/tree/master/src/main/java/net/fabricmc/loader/impl/util/version) to typescript.

```ts
import { parseVersionRange, FabricSemanticVersion } from "@xmcl/semver";

const versionRangeString = ">=1.0+fabric+minecraft"; // this is invalid as a normal semver but valid here
const versionRange = parseVersionRange(versionRangeString);

const versionString = "1.21"; // a Minecraft version
const semver = parseSemanticVersion(versionString);

const isVersionInRange = versionRange.test(semver); // is version in this version range
```
