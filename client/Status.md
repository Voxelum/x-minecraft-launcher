# Interface Status

The json format for Minecraft server handshake status query response
## 🏷️ Properties

### description

```ts
description: string | TextComponent
```
The motd of server, which might be the raw TextComponent string or structurelized TextComponent JSON
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L74" target="_blank" rel="noreferrer">packages/client/status.ts:74</a>
</p>


### favicon

```ts
favicon: string
```
The base 64 favicon data
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L78" target="_blank" rel="noreferrer">packages/client/status.ts:78</a>
</p>


### modinfo <Badge type="info" text="optional" />

```ts
modinfo: { modList: ForgeModIdentity[]; type: string }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L79" target="_blank" rel="noreferrer">packages/client/status.ts:79</a>
</p>


### ping

```ts
ping: number
```
The ping from server
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L86" target="_blank" rel="noreferrer">packages/client/status.ts:86</a>
</p>


### players

```ts
players: { max: number; online: number; sample?: GameProfile[] }
```
The player info in server
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L57" target="_blank" rel="noreferrer">packages/client/status.ts:57</a>
</p>


### version

```ts
version: { name: string; protocol: number }
```
The version info of the server
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/client/status.ts#L43" target="_blank" rel="noreferrer">packages/client/status.ts:43</a>
</p>


