# Class Guild

## 🏭 Constructors

### constructor

```ts
Guild(client: Client, props: Record<string, any>): Guild
```
#### Parameters

- **client**: `Client`
- **props**: `Record<string, any>`
#### Return Type

- `Guild`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Guild.ts#L26" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Guild.ts:26</a>
</p>


## 🏷️ Properties

### client

```ts
client: Client
```
the client instance
*Inherited from: `Base.client`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Base.ts#L7" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Base.ts:7</a>
</p>


### icon_url

```ts
icon_url: string | null
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Guild.ts#L14" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Guild.ts:14</a>
</p>


### id

```ts
id: string
```
guild id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Guild.ts#L9" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Guild.ts:9</a>
</p>


### members

```ts
members: User[] = []
```
guild member list
(always an empty array)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Guild.ts#L20" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Guild.ts:20</a>
</p>


### name

```ts
name: string
```
guild name (2-100 characters, excluding trailing and leading whitespace)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Guild.ts#L13" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Guild.ts:13</a>
</p>


### vanity_url_code

```ts
vanity_url_code: string | null
```
the vanity url code for the guild
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Guild.ts#L24" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Guild.ts:24</a>
</p>


