# Interface DownloadResult

The outcome reported to the controller when a single connection ends,
whether it completed, was aborted by the controller, or failed.
## 🏷️ Properties

### abortReason <Badge type="info" text="optional" />

```ts
abortReason: ManagedAbortReason
```
Managed controller abort category, when outcome is ``aborted``.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L70" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:70</a>
</p>


### committed <Badge type="info" text="optional" />

```ts
committed: boolean
```
Whether the managed-abort budget was exhausted and this attempt had to finish.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L78" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:78</a>
</p>


### duration

```ts
duration: number
```
Wall-clock duration of the connection, in milliseconds, measured
from the first body byte.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L63" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:63</a>
</p>


### failureReason <Badge type="info" text="optional" />

```ts
failureReason: "range-not-supported" | "cancelled" | "request"
```
Sanitized failure category. Never contains an error message, URL, or path.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L80" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:80</a>
</p>


### fallback <Badge type="info" text="optional" />

```ts
fallback: boolean
```
Whether this attempt used a fallback URL instead of the preferred URL.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L76" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:76</a>
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


### ranged <Badge type="info" text="optional" />

```ts
ranged: boolean
```
Whether this connection fetched one segment of a split range download.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L72" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:72</a>
</p>


### received

```ts
received: number
```
Total bytes transferred on this connection.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L58" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:58</a>
</p>


### resumed <Badge type="info" text="optional" />

```ts
resumed: boolean
```
Whether this attempt resumed bytes already written by an earlier attempt.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L74" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:74</a>
</p>


### speed

```ts
speed: number
```
Average throughput in bytes/second over the connection lifetime.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L67" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:67</a>
</p>


