# Client Module

[![npm version](https://img.shields.io/npm/v/@xmcl/client.svg)](https://www.npmjs.com/package/@xmcl/client)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/client.svg)](https://npmjs.com/@xmcl/client)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/client)](https://packagephobia.now.sh/result?p=@xmcl/client)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Minecraft socket pipeline utilities. Support Minecraft lan server discovery.

## Usage

### Ping Minecraft Server

Read sever info (server ip, port) and fetch its status (ping, server motd):

```ts
import { queryStatus, Status, QueryOptions } from '@xmcl/client'
const serverInfo = {
    host: 'your host',
    port: 25565, // be default
};
const options: QueryOptions = {
    /**
     * see http://wiki.vg/Protocol_version_numbers
     */
    protocol: 203,
};
const rawStatusJson: Status = await fetchStatus(info, options);
```

### Detect LAN Minecraft Server

You can detect if player share LAN server.

Or you can fake a LAN server.

```ts
import { MinecraftLanDiscover, LanServerInfo } from '@xmcl/client'
const discover = new MinecraftLanDiscover();

await discover.bind(); // start to listen any lan server

discover.on('discover', ({ motd, port }: LanServerInfo) => {
    console.log(motd); // server motd
    console.log(port); // server port
})

const isReady = discover.isReady // a boolean represent whether the discover is ready to use

// you can also fake a lan server
discover.broadcast({
    motd: 'your motd',
    port: 2384 // fake port
});
// fake LAN server is useful when you want to implement the P2P connection between two players

dicover.destroy(); // stop listening

```
