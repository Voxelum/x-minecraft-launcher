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

## 🧾 Classes

<div class="definition-grid class"><a href="client/Channel">Channel</a><a href="client/Handshake">Handshake</a><a href="client/MinecraftLanDiscover">MinecraftLanDiscover</a><a href="client/PacketDecoder">PacketDecoder</a><a href="client/PacketEmitter">PacketEmitter</a><a href="client/PacketEncoder">PacketEncoder</a><a href="client/PacketInBound">PacketInBound</a><a href="client/PacketOutbound">PacketOutbound</a><a href="client/Ping">Ping</a><a href="client/Pong">Pong</a><a href="client/ServerQuery">ServerQuery</a><a href="client/ServerStatus">ServerStatus</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="client/Coder">Coder</a><a href="client/LanServerInfo">LanServerInfo</a><a href="client/PacketRegistry">PacketRegistry</a><a href="client/PacketRegistryEntry">PacketRegistryEntry</a><a href="client/QueryOptions">QueryOptions</a><a href="client/SlotData">SlotData</a><a href="client/Status">Status</a></div>

## 🏭 Functions

### createChannel

```ts
createChannel(): Channel
```
Create a channel with Handleshake, ServerQuery, ServerStatus, Ping, Pong packets are registered.

This is a lower level function for the case that you want to use channel directly
#### Return Type

- `Channel`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L116" target="_blank" rel="noreferrer">packages/client/status.ts:116</a>
</p>


### createClient

```ts
createClient(protocol: number, timeout: number): { channel: any; protocol: any; query: any }
```
Create a query client for certain protocol and timeout setting.
#### Parameters

- **protocol**: `number`
The protocol number
- **timeout**: `number`
The timeout millisecond
#### Return Type

- `{ channel: any; protocol: any; query: any }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L166" target="_blank" rel="noreferrer">packages/client/status.ts:166</a>
</p>


### Field

```ts
Field(type: Coder<T>): (target: any, key: string) => void
```
Annotate the field type in your packet. Assign a coder for serialization/deserialization.
This will generate a list of ``FieldType`` in your class prototype.
#### Parameters

- **type**: `Coder<T>`
The coder to serialize/deserialize the field.
#### Return Type

- `(target: any, key: string) => void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L44" target="_blank" rel="noreferrer">packages/client/packet.ts:44</a>
</p>


### getPacketRegistryEntry

```ts
getPacketRegistryEntry(clazz: (args: any) => any): PacketRegistryEntry
```
Get a packet registry entry for a class
#### Parameters

- **clazz**: `(args: any) => any`
The class object
#### Return Type

- `PacketRegistryEntry`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L33" target="_blank" rel="noreferrer">packages/client/packet.ts:33</a>
</p>


### Packet

```ts
Packet(side: Side, id: number, state: keyof States, name: string= ''): (constructor: (args: any[]) => any) => void
```
Decoarte for you packet class.
This will generate a ``PacketRegistryEntry`` in your class prototype.
#### Parameters

- **side**: `Side`
The side of your packet
- **id**: `number`
The id of your packet
- **state**: `keyof States`
The state of you packet should be
- **name**: `string`
#### Return Type

- `(constructor: (args: any[]) => any) => void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L61" target="_blank" rel="noreferrer">packages/client/packet.ts:61</a>
</p>


### queryStatus

```ts
queryStatus(server: { host: string; port?: number }, options: QueryOptions= {}): Promise<Status>
```
Query the server status in raw JSON format in one shot.
#### Parameters

- **server**: `{ host: string; port?: number }`
The server information
- **options**: `QueryOptions`
The query options
#### Return Type

- `Promise<Status>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L132" target="_blank" rel="noreferrer">packages/client/status.ts:132</a>
</p>



## 🏷️ Variables

### Bool <Badge type="tip" text="const" />

```ts
Bool: Coder<boolean> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L50" target="_blank" rel="noreferrer">packages/client/coders.ts:50</a>
</p>


### Byte <Badge type="tip" text="const" />

```ts
Byte: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L36" target="_blank" rel="noreferrer">packages/client/coders.ts:36</a>
</p>


### ByteArray <Badge type="tip" text="const" />

```ts
ByteArray: Coder<Int8Array> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L203" target="_blank" rel="noreferrer">packages/client/coders.ts:203</a>
</p>


### Double <Badge type="tip" text="const" />

```ts
Double: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L64" target="_blank" rel="noreferrer">packages/client/coders.ts:64</a>
</p>


### Float <Badge type="tip" text="const" />

```ts
Float: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L57" target="_blank" rel="noreferrer">packages/client/coders.ts:57</a>
</p>


### Int <Badge type="tip" text="const" />

```ts
Int: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L29" target="_blank" rel="noreferrer">packages/client/coders.ts:29</a>
</p>


### Json <Badge type="tip" text="const" />

```ts
Json: Coder<any> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L159" target="_blank" rel="noreferrer">packages/client/coders.ts:159</a>
</p>


### LAN_MULTICAST_ADDR <Badge type="tip" text="const" />

```ts
LAN_MULTICAST_ADDR: "224.0.2.60" = '224.0.2.60'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/lan.ts#L4" target="_blank" rel="noreferrer">packages/client/lan.ts:4</a>
</p>


### LAN_MULTICAST_ADDR_V6 <Badge type="tip" text="const" />

```ts
LAN_MULTICAST_ADDR_V6: "FF75:230::60" = 'FF75:230::60'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/lan.ts#L5" target="_blank" rel="noreferrer">packages/client/lan.ts:5</a>
</p>


### LAN_MULTICAST_PORT <Badge type="tip" text="const" />

```ts
LAN_MULTICAST_PORT: 4445 = 4445
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/lan.ts#L6" target="_blank" rel="noreferrer">packages/client/lan.ts:6</a>
</p>


### Long <Badge type="tip" text="const" />

```ts
Long: Coder<bigint> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L132" target="_blank" rel="noreferrer">packages/client/coders.ts:132</a>
</p>


### PacketFieldsMetadata <Badge type="tip" text="const" />

```ts
PacketFieldsMetadata: typeof PacketFieldsMetadata = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L27" target="_blank" rel="noreferrer">packages/client/packet.ts:27</a>
</p>


### PacketMetadata <Badge type="tip" text="const" />

```ts
PacketMetadata: typeof PacketMetadata = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L26" target="_blank" rel="noreferrer">packages/client/packet.ts:26</a>
</p>


### Short <Badge type="tip" text="const" />

```ts
Short: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L118" target="_blank" rel="noreferrer">packages/client/coders.ts:118</a>
</p>


### Slot <Badge type="tip" text="const" />

```ts
Slot: Coder<SlotData> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L168" target="_blank" rel="noreferrer">packages/client/coders.ts:168</a>
</p>


### String <Badge type="tip" text="const" />

```ts
String: Coder<string> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L147" target="_blank" rel="noreferrer">packages/client/coders.ts:147</a>
</p>


### UByte <Badge type="tip" text="const" />

```ts
UByte: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L43" target="_blank" rel="noreferrer">packages/client/coders.ts:43</a>
</p>


### UShort <Badge type="tip" text="const" />

```ts
UShort: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L125" target="_blank" rel="noreferrer">packages/client/coders.ts:125</a>
</p>


### UUID <Badge type="tip" text="const" />

```ts
UUID: Coder<string> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L71" target="_blank" rel="noreferrer">packages/client/coders.ts:71</a>
</p>


### VarInt <Badge type="tip" text="const" />

```ts
VarInt: Coder<number> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L22" target="_blank" rel="noreferrer">packages/client/coders.ts:22</a>
</p>


### VarLong <Badge type="tip" text="const" />

```ts
VarLong: Coder<bigint> = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/coders.ts#L139" target="_blank" rel="noreferrer">packages/client/coders.ts:139</a>
</p>



## ⏩ Type Aliases

### FieldType

```ts
FieldType: (type: Coder<T>) => (target: any, key: string) => void
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L19" target="_blank" rel="noreferrer">packages/client/packet.ts:19</a>
</p>


### PacketType

```ts
PacketType: (side: Side, id: number, state: State) => (constructor: (args: any[]) => any) => void
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L20" target="_blank" rel="noreferrer">packages/client/packet.ts:20</a>
</p>


### Side

```ts
Side: "server" | "client"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/packet.ts#L9" target="_blank" rel="noreferrer">packages/client/packet.ts:9</a>
</p>


### State

```ts
State: keyof States
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/channel.ts#L9" target="_blank" rel="noreferrer">packages/client/channel.ts:9</a>
</p>



