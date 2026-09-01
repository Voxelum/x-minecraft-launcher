# Class Lobby

## 🏭 Constructors

### constructor

```ts
Lobby(client: Client, props: Record<string, any>): Lobby
```
#### Parameters

- **client**: `Client`
- **props**: `Record<string, any>`
#### Return Type

- `Lobby`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L25" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:25</a>
</p>


## 🏷️ Properties

### application_id

```ts
application_id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L13" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:13</a>
</p>


### capacity

```ts
capacity: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L14" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:14</a>
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


### id

```ts
id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L15" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:15</a>
</p>


### locked

```ts
locked: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L16" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:16</a>
</p>


### members

```ts
members: { metadata: any; user: User }[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L17" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:17</a>
</p>


### metadata

```ts
metadata: any
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L18" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:18</a>
</p>


### owner_id

```ts
owner_id: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L19" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:19</a>
</p>


### region

```ts
region: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L20" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:20</a>
</p>


### secret

```ts
secret: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L21" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:21</a>
</p>


### type

```ts
type: LobbyType
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L22" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:22</a>
</p>


### voice_states

```ts
voice_states: GatewayVoiceState
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L23" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:23</a>
</p>


## 🔧 Methods

### delete

```ts
delete(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L85" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:85</a>
</p>


### disconnect

```ts
disconnect(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L81" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:81</a>
</p>


### joinVoice

```ts
joinVoice(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L42" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:42</a>
</p>


### leaveVoice

```ts
leaveVoice(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L46" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:46</a>
</p>


### update

```ts
update(type: LobbyType, owner_id: string, capacity: number, locked: boolean, metadata: any): Promise<void>
```
#### Parameters

- **type**: `LobbyType`
- **owner_id**: `string`
- **capacity**: `number`
- **locked**: `boolean`
- **metadata**: `any`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L50" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:50</a>
</p>


### updateMember

```ts
updateMember(userId: string, metadata: any): Promise<void>
```
#### Parameters

- **userId**: `string`
- **metadata**: `any`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Lobby.ts#L73" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Lobby.ts:73</a>
</p>


