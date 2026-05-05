# Nbt Module

[![npm version](https://img.shields.io/npm/v/@xmcl/nbt.svg)](https://www.npmjs.com/package/@xmcl/nbt)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/nbt.svg)](https://npmjs.com/@xmcl/nbt)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/nbt)](https://packagephobia.now.sh/result?p=@xmcl/nbt)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide function to read NBT binary format to json.

## Usage

### Read and Write NBT

You can simply deserialize/serialize nbt.

```ts
import { serialize, deserialize } from "@xmcl/nbt";
const fileData: Buffer;
// compressed = undefined will not perform compress algorithm
// compressed = true will use gzip algorithm
const compressed: true | "gzip" | "deflate" | undefined;
const readed: any = await deserialize(fileData, { compressed });
// The deserialize return object contain NBTPrototype property which define its nbt type
// After you do the modification on it, you can serialize it back to NBT
const buf: Buffer = await serialize(readed, { compressed });
```

You can use class with annotation (decorator) to serialize/deserialize the type consistently.

Suppose you are reading the [servers.dat](https://minecraft.gamepedia.com/Servers.dat_format). You can have:

```ts
import { serialize, deserialize, TagType } from "@xmcl/nbt";

class ServerInfo {
    @TagType(TagType.String)
    icon: string = "";
    @TagType(TagType.String)
    ip: string = "";
    @TagType(TagType.String)
    name: string = "";
    @TagType(TagType.Byte)
    acceptTextures: number = 0;
}

class Servers {
    @TagType([ServerInfo])
    servers: ServerInfo[] = []
}

// read
// explict tell the function to deserialize into the type Servers
const servers = await deserialize(data, { type: Servers });
const infos: ServerInfo[] = servers.servers;

// write
const servers: Servers;
const binary = await serialize(servers);
```
