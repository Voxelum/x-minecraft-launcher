# Interface DownloadSample

A throughput observation for a single in-flight download connection.

Emitted periodically (every ``DownloadController.sampleInterval`` ms)
while the body is streaming, so a controller can decide whether the
assigned host is fast enough to keep.
## 🏷️ Properties

### elapsed

```ts
elapsed: number
```
Milliseconds elapsed since the first body byte of this connection
arrived. Useful to ignore the TCP slow-start ramp.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L42" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:42</a>
</p>


### finalUrl <Badge type="info" text="optional" />

```ts
finalUrl: string
```
The final URL after following redirects, if known. For a CDN that
redirects to a mirror this is the mirror URL actually serving bytes.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L18" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:18</a>
</p>


### host <Badge type="info" text="optional" />

```ts
host: string
```
The final host after following redirects, if known. Use this as the
reputation key for a distributed CDN.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L23" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:23</a>
</p>


### origin

```ts
origin: string
```
The origin the request was dispatched to (e.g. the BMCLAPI origin,
before any redirect).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L13" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:13</a>
</p>


### received

```ts
received: number
```
Bytes of this download (or segment) already on disk, including bytes
from earlier resumed attempts. ``total - received`` is the remaining
work, which the optimal-stop rule compares against.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L29" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:29</a>
</p>


### speed

```ts
speed: number
```
Throughput over the most recent sampling window, in bytes/second.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L37" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:37</a>
</p>


### total

```ts
total: number
```
Total expected bytes for this download (or segment), or 0 if unknown.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L33" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:33</a>
</p>


