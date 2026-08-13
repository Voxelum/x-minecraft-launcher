## 🧾 Classes

<div class="definition-grid class"><a href="bore/AuthenticationError">AuthenticationError</a><a href="bore/BoreClient">BoreClient</a><a href="bore/ConnectionError">ConnectionError</a><a href="bore/ProtocolError">ProtocolError</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="bore/AcceptMessage">AcceptMessage</a><a href="bore/AuthenticateMessage">AuthenticateMessage</a><a href="bore/BoreClientOptions">BoreClientOptions</a><a href="bore/ChallengeMessage">ChallengeMessage</a><a href="bore/ConnectionMessage">ConnectionMessage</a><a href="bore/ErrorMessage">ErrorMessage</a><a href="bore/HeartbeatMessage">HeartbeatMessage</a><a href="bore/HelloMessage">HelloMessage</a><a href="bore/HelloResponse">HelloResponse</a><a href="bore/Logger">Logger</a></div>

## ⏩ Type Aliases

### ClientMessage

```ts
ClientMessage: AuthenticateMessage | HelloMessage | AcceptMessage
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/types.ts#L29" target="_blank" rel="noreferrer">packages/bore/types.ts:29</a>
</p>


### ServerMessage

```ts
ServerMessage: ChallengeMessage | HelloResponse | HeartbeatMessage | ConnectionMessage | ErrorMessage
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/types.ts#L51" target="_blank" rel="noreferrer">packages/bore/types.ts:51</a>
</p>



