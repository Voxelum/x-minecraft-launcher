# Class BoreClient

## 🏭 Constructors

### constructor

```ts
BoreClient(options: BoreClientOptions): BoreClient
```
#### Parameters

- **options**: `BoreClientOptions`
#### Return Type

- `BoreClient`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/client.ts#L32" target="_blank" rel="noreferrer">packages/bore/client.ts:32</a>
</p>


## 🔧 Methods

### getRemotePort <Badge type="tip" text="public" />

```ts
getRemotePort(): number | undefined
```
获取远程端口
#### Return Type

- `number | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/client.ts#L292" target="_blank" rel="noreferrer">packages/bore/client.ts:292</a>
</p>


### isClientRunning <Badge type="tip" text="public" />

```ts
isClientRunning(): boolean
```
检查客户端是否运行中
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/client.ts#L299" target="_blank" rel="noreferrer">packages/bore/client.ts:299</a>
</p>


### start <Badge type="tip" text="public" />

```ts
start(): Promise<number>
```
启动 bore 客户端
#### Return Type

- `Promise<number>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/client.ts#L44" target="_blank" rel="noreferrer">packages/bore/client.ts:44</a>
</p>


### stop <Badge type="tip" text="public" />

```ts
stop(): void
```
停止客户端并清理资源
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/bore/client.ts#L273" target="_blank" rel="noreferrer">packages/bore/client.ts:273</a>
</p>


