# Class User

## 🏭 Constructors

### constructor

```ts
User(client: Client, props: Record<string, any>): User
```
#### Parameters

- **client**: `Client`
- **props**: `Record<string, any>`
#### Return Type

- `User`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L52" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:52</a>
</p>


## 🏷️ Properties

### avatar

```ts
avatar: string | null
```
the user's [avatar hash](https://discord.com/developers/docs/reference#image-formatting)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L26" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:26</a>
</p>


### avatar_decoration <Badge type="info" text="optional" />

```ts
avatar_decoration: string | null
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L50" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:50</a>
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


### discriminator

```ts
discriminator: string
```
the user's 4-digit discord-tag
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L22" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:22</a>
</p>


### flags <Badge type="info" text="optional" />

```ts
flags: UserFlags
```
the [flags](https://discord.com/developers/docs/resources/user#user-object-user-flags) on a user's account
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L30" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:30</a>
</p>


### id

```ts
id: string
```
the user's id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L14" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:14</a>
</p>


### premium_type <Badge type="info" text="optional" />

```ts
premium_type: UserPremiumType
```
the [type of Nitro subscription](https://discord.com/developers/docs/resources/user#user-object-premium-types) on a user's account
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L34" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:34</a>
</p>


### presence <Badge type="info" text="optional" />

```ts
presence: { activities?: GatewayActivity[]; status?: PresenceUpdateStatus }
```
user's rich presence
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L43" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:43</a>
</p>


### public_flags <Badge type="info" text="optional" />

```ts
public_flags: UserFlags
```
the public [flags](https://discord.com/developers/docs/resources/user#user-object-user-flags) on a user's account
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L38" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:38</a>
</p>


### username

```ts
username: string
```
the user's username, not unique across the platform
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L18" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:18</a>
</p>


## 🔑 Accessors

### avatarUrl

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L66" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:66</a>
</p>


### defaultAvatarUrl

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L76" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:76</a>
</p>


### tag

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/User.ts#L83" target="_blank" rel="noreferrer">packages/discord-rpc/structures/User.ts:83</a>
</p>


