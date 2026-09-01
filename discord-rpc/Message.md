# Class Message

## 🏭 Constructors

### constructor

```ts
Message(client: Client, props: Record<string, any>): Message
```
#### Parameters

- **client**: `Client`
- **props**: `Record<string, any>`
#### Return Type

- `Message`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L74" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:74</a>
</p>


## 🏷️ Properties

### attachments

```ts
attachments: APIAttachment[]
```
any attached files
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L60" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:60</a>
</p>


### author

```ts
author: User
```
the author of this message
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L64" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:64</a>
</p>


### author_color

```ts
author_color: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L28" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:28</a>
</p>


### blocked

```ts
blocked: boolean
```
if the message's author is blocked
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L14" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:14</a>
</p>


### bot

```ts
bot: boolean
```
if the message is sent by a bot
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L18" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:18</a>
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


### content

```ts
content: string
```
contents of the message
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L22" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:22</a>
</p>


### content_parsed

```ts
content_parsed: any[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L23" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:23</a>
</p>


### edited_timestamp

```ts
edited_timestamp: string | null
```
when this message was edited (or null if never)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L32" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:32</a>
</p>


### embeds

```ts
embeds: APIEmbed[]
```
any embedded content
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L56" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:56</a>
</p>


### id

```ts
id: string
```
id of the message
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L10" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:10</a>
</p>


### mention_everyone

```ts
mention_everyone: boolean
```
whether this message mentions everyone
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L48" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:48</a>
</p>


### mention_roles

```ts
mention_roles: string[]
```
roles specifically mentioned in this message
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L52" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:52</a>
</p>


### mentions

```ts
mentions: User[]
```
users specifically mentioned in the message
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L44" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:44</a>
</p>


### nick

```ts
nick: string
```
author's server nickname
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L27" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:27</a>
</p>


### pinned

```ts
pinned: boolean
```
whether this message is pinned
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L68" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:68</a>
</p>


### timestamp

```ts
timestamp: string
```
when this message was sent
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L36" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:36</a>
</p>


### tts

```ts
tts: boolean
```
whether this was a TTS message
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L40" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:40</a>
</p>


### type

```ts
type: MessageType
```
[type of message](https://discord.com/developers/docs/resources/channel#message-object-message-types)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Message.ts#L72" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Message.ts:72</a>
</p>


