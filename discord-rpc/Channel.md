# Class Channel

## 🏭 Constructors

### constructor

```ts
Channel(client: Client, props: Record<string, any>): Channel
```
#### Parameters

- **client**: `Client`
- **props**: `Record<string, any>`
#### Return Type

- `Channel`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L48" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:48</a>
</p>


## 🏷️ Properties

### bitrate <Badge type="info" text="optional" />

```ts
bitrate: number
```
(voice) bitrate of voice channel
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L30" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:30</a>
</p>


### client

```ts
client: Client
```
the client instance
*Inherited from: `Base.client`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Base.ts#L7" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Base.ts:7</a>
</p>


### guild_id <Badge type="info" text="optional" />

```ts
guild_id: string
```
channel's guild id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L14" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:14</a>
</p>


### id

```ts
id: string
```
channel id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L10" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:10</a>
</p>


### messages <Badge type="info" text="optional" />

```ts
messages: Message[]
```
(text) channel's messages
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L46" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:46</a>
</p>


### name

```ts
name: string
```
channel name
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L18" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:18</a>
</p>


### position <Badge type="info" text="optional" />

```ts
position: number
```
position of channel in channel list
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L38" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:38</a>
</p>


### topic <Badge type="info" text="optional" />

```ts
topic: string
```
(text) channel topic
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L26" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:26</a>
</p>


### type

```ts
type: ChannelType
```
channel type (guild text: 0, guild voice: 2, dm: 1, group dm: 3)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L22" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:22</a>
</p>


### user_limit <Badge type="info" text="optional" />

```ts
user_limit: number
```
(voice) user limit of voice channel (0 for none)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L34" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:34</a>
</p>


### voice_states <Badge type="info" text="optional" />

```ts
voice_states: GatewayVoiceState[]
```
(voice) channel's voice states
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Channel.ts#L42" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Channel.ts:42</a>
</p>


