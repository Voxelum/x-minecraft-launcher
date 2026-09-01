# Interface ClientOptions

## 🏷️ Properties

### clientId

```ts
clientId: string
```
application id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L29" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:29</a>
</p>


### clientSecret <Badge type="info" text="optional" />

```ts
clientSecret: string
```
application secret
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L33" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:33</a>
</p>


### dispatcher <Badge type="info" text="optional" />

```ts
dispatcher: Dispatcher
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L52" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:52</a>
</p>


### pipeId <Badge type="info" text="optional" />

```ts
pipeId: number
```
pipe id
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L37" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:37</a>
</p>


### transport <Badge type="info" text="optional" />

```ts
transport: { pathList?: FormatFunction[]; type?: "ipc" | "websocket" | ((options: TransportOptions) => Transport) }
```
transport configs
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/discord-rpc/Client.ts#L41" target="_blank" rel="noreferrer">packages/discord-rpc/Client.ts:41</a>
</p>


