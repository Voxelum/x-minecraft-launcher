# Interface DownloadResult

The outcome reported to the controller when a single connection ends,
whether it completed, was aborted by the controller, or failed.
## 🏷️ Properties

### duration

```ts
duration: number
```
Wall-clock duration of the connection, in milliseconds, measured
from the first body byte.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L63" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:63</a>
</p>


### finalUrl <Badge type="info" text="optional" />

```ts
finalUrl: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L53" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:53</a>
</p>


### host <Badge type="info" text="optional" />

```ts
host: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L54" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:54</a>
</p>


### origin

```ts
origin: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L52" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:52</a>
</p>


### outcome

```ts
outcome: "completed" | "aborted" | "failed"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L68" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:68</a>
</p>


### received

```ts
received: number
```
Total bytes transferred on this connection.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L58" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:58</a>
</p>


### speed

```ts
speed: number
```
Average throughput in bytes/second over the connection lifetime.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L67" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:67</a>
</p>


