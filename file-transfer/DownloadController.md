# Interface DownloadController

A pluggable strategy that observes a download's per-connection
throughput and may request a *managed abort* — which makes ``download``
resume the transfer (via an HTTP ``Range`` request) on a fresh
connection instead of failing the whole download.

This is the seam the BMCLAPI coordinator plugs into to drop slow
mirror assignments and re-request the signed API for a (hopefully)
faster host. When no controller is supplied to ``download``, behaviour
is byte-for-byte unchanged.
## 🏷️ Properties

### maxNoProgressRerolls <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
maxNoProgressRerolls: number
```
Maximum *no-progress* re-rolls (TTFB/stall, i.e. dead/stuck mirrors)
to attempt on one URL before falling through to the next fallback
URL (e.g. the official source). Keeps a dead CDN from blocking the
download indefinitely. (Default applied by ``download``: 2.)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L107" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:107</a>
</p>


### maxResumes <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
maxResumes: number
```
Maximum number of managed aborts before ``download`` stops resuming
and surfaces the underlying failure. Bounds worst-case rerolls.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L100" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:100</a>
</p>


### rangeConcurrency <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
rangeConcurrency: number
```
Number of parallel segments to use when range-splitting a large
file. (Default applied by ``download``: 4.)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L134" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:134</a>
</p>


### rangeSplitThreshold <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
rangeSplitThreshold: number
```
Files at least this large are split into ``rangeConcurrency`` byte
segments fetched in parallel — each a separate request, so on a
distributed CDN each segment streams from a different mirror at
once. ``0`` disables splitting. (Default applied by ``download``: 4 MiB.)
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L129" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:129</a>
</p>


### sampleInterval <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
sampleInterval: number
```
Minimum milliseconds between throughput samples.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L87" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:87</a>
</p>


### stallTimeout <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
stallTimeout: number
```
After the first byte, if no further byte arrives within this many ms,
treat the connection as stalled and abort it (a mid-stream stuck
mirror). Active even in the committed finishing phase. ``0`` disables.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L122" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:122</a>
</p>


### ttfbDeadline <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
ttfbDeadline: number
```
If no body byte arrives within this many ms of starting a connection
(covering connect + redirect + TTFB), trigger a managed abort so a
dead/blackholed mirror is re-rolled quickly instead of waiting for
the dispatcher's much longer headers/body timeout. ``0`` disables it.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L115" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:115</a>
</p>


### warmup <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
warmup: number
```
Ignore the connection's throughput (never abort) until this many
milliseconds have elapsed since the first byte. Guards against
killing a healthy connection during TCP slow-start.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L94" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:94</a>
</p>


## 🔧 Methods

### isAbortable <Badge type="info" text="optional" />

```ts
isAbortable(origin: string): boolean
```
Whether the given origin is worth aborting (TTFB/stall) and
re-rolling — i.e. a re-assignable CDN whose next request can land on
a different mirror. Non-re-assignable origins (e.g. the official
source) are NOT aborted on TTFB/stall: re-rolling cannot help and
the slow-but-working source is the last resort. Defaults to ``true``
(abort everything) when not implemented.
#### Parameters

- **origin**: `string`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L157" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:157</a>
</p>


### onSample <Badge type="info" text="optional" />

```ts
onSample(sample: DownloadSample): DownloadDecision
```
Inspect a throughput sample and decide whether to keep the
connection (``'continue'``) or trigger a managed abort + resume
(``'abort'``).
#### Parameters

- **sample**: `DownloadSample`
#### Return Type

- `DownloadDecision`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L140" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:140</a>
</p>


### report <Badge type="info" text="optional" />

```ts
report(result: DownloadResult): void
```
Receive the final outcome of a single connection, for updating a
reputation / speed model.
#### Parameters

- **result**: `DownloadResult`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L171" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:171</a>
</p>


### shouldReroll <Badge type="info" text="optional" />

```ts
shouldReroll(origin: string, error: unknown): boolean
```
Decide whether a *failed* attempt (HTTP error, network error) on the
given origin should be retried by re-rolling — i.e. re-requesting the
same URL to be re-assigned a different mirror — rather than treated
as terminal. For a distributed CDN a 403/404/5xx from one mirror
often succeeds on the next assignment. Bounded by ``maxResumes``.
#### Parameters

- **origin**: `string`
- **error**: `unknown`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L148" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:148</a>
</p>


### shouldSkip <Badge type="info" text="optional" />

```ts
shouldSkip(origin: string): boolean
```
Whether requests to the given origin should be skipped *entirely*
right now — a circuit breaker. When a re-assignable CDN is failing
hard (delivering no data), ``download`` skips its URLs and goes
straight to a fallback (e.g. the official source) until the breaker
resets. ``download`` never skips the last remaining URL. Defaults to
never-skip when not implemented.
#### Parameters

- **origin**: `string`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L166" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:166</a>
</p>


