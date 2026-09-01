## 🧾 Classes

<div class="definition-grid class"><a href="discord-rpc/CertifiedDevice">CertifiedDevice</a><a href="discord-rpc/Channel">Channel</a><a href="discord-rpc/Client">Client</a><a href="discord-rpc/ClientUser">ClientUser</a><a href="discord-rpc/Guild">Guild</a><a href="discord-rpc/Lobby">Lobby</a><a href="discord-rpc/Message">Message</a><a href="discord-rpc/Transport">Transport</a><a href="discord-rpc/User">User</a><a href="discord-rpc/VoiceSettings">VoiceSettings</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="discord-rpc/ClientOptions">ClientOptions</a><a href="discord-rpc/CommandIncoming">CommandIncoming</a><a href="discord-rpc/CommandOutgoing">CommandOutgoing</a><a href="discord-rpc/Device">Device</a><a href="discord-rpc/Model">Model</a><a href="discord-rpc/ShortcutKeyCombo">ShortcutKeyCombo</a><a href="discord-rpc/Vendor">Vendor</a><a href="discord-rpc/VoiceInput">VoiceInput</a><a href="discord-rpc/VoiceMode">VoiceMode</a><a href="discord-rpc/VoiceOutput">VoiceOutput</a></div>

## 🏳️ Enums

<div class="definition-grid enum"><a href="discord-rpc/CUSTOM_RPC_ERROR_CODE">CUSTOM_RPC_ERROR_CODE</a><a href="discord-rpc/DeviceType">DeviceType</a><a href="discord-rpc/KEY_TYPE">KEY_TYPE</a><a href="discord-rpc/LobbyType">LobbyType</a><a href="discord-rpc/RPC_CLOSE_CODE">RPC_CLOSE_CODE</a><a href="discord-rpc/RPC_ERROR_CODE">RPC_ERROR_CODE</a></div>

## ⏩ Type Aliases

### AuthorizeOptions

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L18" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:18</a>
</p>


### ClientEvents

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L55" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:55</a>
</p>


### FormatFunction

```ts
FormatFunction: (id: number) => [path: string, skipCheck?: boolean]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/transport/IPC.ts#L16" target="_blank" rel="noreferrer">packages/discord-rpc/transport/IPC.ts:16</a>
</p>


### RPC_CMD

```ts
RPC_CMD: "DISPATCH" | "SET_CONFIG" | "AUTHORIZE" | "AUTHENTICATE" | "GET_GUILD" | "GET_GUILDS" | "GET_CHANNEL" | "GET_CHANNELS" | "CREATE_CHANNEL_INVITE" | "GET_RELATIONSHIPS" | "GET_USER" | "SUBSCRIBE" | "UNSUBSCRIBE" | "SET_USER_VOICE_SETTINGS" | "SET_USER_VOICE_SETTINGS_2" | "SELECT_VOICE_CHANNEL" | "GET_SELECTED_VOICE_CHANNEL" | "SELECT_TEXT_CHANNEL" | "GET_VOICE_SETTINGS" | "SET_VOICE_SETTINGS_2" | "SET_VOICE_SETTINGS" | "SET_ACTIVITY" | "SEND_ACTIVITY_JOIN_INVITE" | "CLOSE_ACTIVITY_JOIN_REQUEST" | "ACTIVITY_INVITE_USER" | "ACCEPT_ACTIVITY_INVITE" | "OPEN_INVITE_DIALOG" | "INVITE_BROWSER" | "DEEP_LINK" | "CONNECTIONS_CALLBACK" | "BILLING_POPUP_BRIDGE_CALLBACK" | "BRAINTREE_POPUP_BRIDGE_CALLBACK" | "GIFT_CODE_BROWSER" | "GUILD_TEMPLATE_BROWSER" | "OVERLAY" | "BROWSER_HANDOFF" | "SET_CERTIFIED_DEVICES" | "GET_IMAGE" | "CREATE_LOBBY" | "UPDATE_LOBBY" | "DELETE_LOBBY" | "UPDATE_LOBBY_MEMBER" | "CONNECT_TO_LOBBY" | "DISCONNECT_FROM_LOBBY" | "SEND_TO_LOBBY" | "SEARCH_LOBBIES" | "CONNECT_TO_LOBBY_VOICE" | "DISCONNECT_FROM_LOBBY_VOICE" | "SET_OVERLAY_LOCKED" | "OPEN_OVERLAY_ACTIVITY_INVITE" | "OPEN_OVERLAY_GUILD_INVITE" | "OPEN_OVERLAY_VOICE_SETTINGS" | "VALIDATE_APPLICATION" | "GET_ENTITLEMENT_TICKET" | "GET_APPLICATION_TICKET" | "START_PURCHASE" | "START_PREMIUM_PURCHASE" | "GET_SKUS" | "GET_ENTITLEMENTS" | "GET_NETWORKING_CONFIG" | "NETWORKING_SYSTEM_METRICS" | "NETWORKING_PEER_METRICS" | "NETWORKING_CREATE_TOKEN" | "SET_USER_ACHIEVEMENT" | "GET_USER_ACHIEVEMENTS" | "USER_SETTINGS_GET_LOCALE" | "GET_ACTIVITY_JOIN_TICKET" | "SEND_GENERIC_EVENT" | "SEND_ANALYTICS_EVENT" | "OPEN_EXTERNAL_LINK" | "CAPTURE_LOG" | "ENCOURAGE_HW_ACCELERATION" | "SET_ORIENTATION_LOCK_STATE"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L109" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:109</a>
</p>


### RPC_EVT

```ts
RPC_EVT: "CURRENT_USER_UPDATE" | "GUILD_STATUS" | "GUILD_CREATE" | "CHANNEL_CREATE" | "RELATIONSHIP_UPDATE" | "VOICE_CHANNEL_SELECT" | "VOICE_STATE_CREATE" | "VOICE_STATE_DELETE" | "VOICE_STATE_UPDATE" | "VOICE_SETTINGS_UPDATE" | "VOICE_SETTINGS_UPDATE_2" | "VOICE_CONNECTION_STATUS" | "SPEAKING_START" | "SPEAKING_STOP" | "GAME_JOIN" | "GAME_SPECTATE" | "ACTIVITY_JOIN" | "ACTIVITY_JOIN_REQUEST" | "ACTIVITY_SPECTATE" | "ACTIVITY_INVITE" | "ACTIVITY_PIP_MODE_UPDATE" | "NOTIFICATION_CREATE" | "MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE" | "LOBBY_DELETE" | "LOBBY_UPDATE" | "LOBBY_MEMBER_CONNECT" | "LOBBY_MEMBER_DISCONNECT" | "LOBBY_MEMBER_UPDATE" | "LOBBY_MESSAGE" | "OVERLAY" | "OVERLAY_UPDATE" | "ENTITLEMENT_CREATE" | "ENTITLEMENT_DELETE" | "USER_ACHIEVEMENT_UPDATE" | "VOICE_CHANNEL_EFFECT_SEND" | "THERMAL_STATE_UPDATE" | "READY" | "ERROR"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L184" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:184</a>
</p>


### SetActivity

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/ClientUser.ts#L9" target="_blank" rel="noreferrer">packages/discord-rpc/structures/ClientUser.ts:9</a>
</p>


### SetActivityResponse

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/ClientUser.ts#L30" target="_blank" rel="noreferrer">packages/discord-rpc/structures/ClientUser.ts:30</a>
</p>


### TransportEvents

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L241" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:241</a>
</p>


### TransportOptions

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/structures/Transport.ts#L260" target="_blank" rel="noreferrer">packages/discord-rpc/structures/Transport.ts:260</a>
</p>



