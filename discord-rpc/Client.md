# Class Client

## 🏭 Constructors

### constructor

```ts
Client(options: ClientOptions): Client
```
#### Parameters

- **options**: `ClientOptions`
#### Return Type

- `Client`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L133" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:133</a>
</p>


## 🏷️ Properties

### application <Badge type="info" text="optional" />

```ts
application: APIApplication
```
current application
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L105" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:105</a>
</p>


### clientId

```ts
clientId: string
```
application id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L78" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:78</a>
</p>


### clientSecret <Badge type="info" text="optional" />

```ts
clientSecret: string
```
application secret
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L82" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:82</a>
</p>


### dispatcher <Badge type="info" text="optional" />

```ts
dispatcher: Dispatcher
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L116" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:116</a>
</p>


### pipeId <Badge type="info" text="optional" />

```ts
pipeId: number
```
pipe id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L87" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:87</a>
</p>


### transport <Badge type="tip" text="readonly" />

```ts
transport: Transport
```
transport instance
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L96" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:96</a>
</p>


### user <Badge type="info" text="optional" />

```ts
user: ClientUser
```
current user
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L101" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:101</a>
</p>


## 🔑 Accessors

### isConnected

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L118" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:118</a>
</p>


## 🔧 Methods

### connect

```ts
connect(): Promise<void>
```
connect to the local rpc server
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L336" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:336</a>
</p>


### destroy

```ts
destroy(): Promise<void>
```
disconnects from the local rpc server
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L397" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:397</a>
</p>


### login

```ts
login(options: AuthorizeOptions): Promise<void>
```
will try to authorize if a scope is specified, else it's the same as ``connect()``
#### Parameters

- **options**: `AuthorizeOptions`
options for the authorization
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L382" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:382</a>
</p>


### subscribe

```ts
subscribe(event: "OVERLAY" | "CURRENT_USER_UPDATE" | "GUILD_STATUS" | "GUILD_CREATE" | "CHANNEL_CREATE" | "RELATIONSHIP_UPDATE" | "VOICE_CHANNEL_SELECT" | "VOICE_STATE_CREATE" | "VOICE_STATE_DELETE" | "VOICE_STATE_UPDATE" | "VOICE_SETTINGS_UPDATE" | "VOICE_SETTINGS_UPDATE_2" | "VOICE_CONNECTION_STATUS" | "SPEAKING_START" | "SPEAKING_STOP" | "GAME_JOIN" | "GAME_SPECTATE" | "ACTIVITY_JOIN" | "ACTIVITY_JOIN_REQUEST" | "ACTIVITY_SPECTATE" | "ACTIVITY_INVITE" | "ACTIVITY_PIP_MODE_UPDATE" | "NOTIFICATION_CREATE" | "MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE" | "LOBBY_DELETE" | "LOBBY_UPDATE" | "LOBBY_MEMBER_CONNECT" | "LOBBY_MEMBER_DISCONNECT" | "LOBBY_MEMBER_UPDATE" | "LOBBY_MESSAGE" | "OVERLAY_UPDATE" | "ENTITLEMENT_CREATE" | "ENTITLEMENT_DELETE" | "USER_ACHIEVEMENT_UPDATE" | "VOICE_CHANNEL_EFFECT_SEND" | "THERMAL_STATE_UPDATE", args: any): Promise<{ unsubscribe: () => void }>
```
Used to subscribe to events. ``evt`` of the payload should be set to the event being subscribed to. ``args`` of the payload should be set to the args needed for the event.
#### Parameters

- **event**: `"OVERLAY" | "CURRENT_USER_UPDATE" | "GUILD_STATUS" | "GUILD_CREATE" | "CHANNEL_CREATE" | "RELATIONSHIP_UPDATE" | "VOICE_CHANNEL_SELECT" | "VOICE_STATE_CREATE" | "VOICE_STATE_DELETE" | "VOICE_STATE_UPDATE" | "VOICE_SETTINGS_UPDATE" | "VOICE_SETTINGS_UPDATE_2" | "VOICE_CONNECTION_STATUS" | "SPEAKING_START" | "SPEAKING_STOP" | "GAME_JOIN" | "GAME_SPECTATE" | "ACTIVITY_JOIN" | "ACTIVITY_JOIN_REQUEST" | "ACTIVITY_SPECTATE" | "ACTIVITY_INVITE" | "ACTIVITY_PIP_MODE_UPDATE" | "NOTIFICATION_CREATE" | "MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE" | "LOBBY_DELETE" | "LOBBY_UPDATE" | "LOBBY_MEMBER_CONNECT" | "LOBBY_MEMBER_DISCONNECT" | "LOBBY_MEMBER_UPDATE" | "LOBBY_MESSAGE" | "OVERLAY_UPDATE" | "ENTITLEMENT_CREATE" | "ENTITLEMENT_DELETE" | "USER_ACHIEVEMENT_UPDATE" | "VOICE_CHANNEL_EFFECT_SEND" | "THERMAL_STATE_UPDATE"`
event name now subscribed to
- **args**: `any`
args for the event
#### Return Type

- `Promise<{ unsubscribe: () => void }>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L318" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:318</a>
</p>


