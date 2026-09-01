# Download Core

[![npm version](https://img.shields.io/npm/v/@xmcl/file-transfer.svg)](https://www.npmjs.com/package/@xmcl/file-transfer)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/file-transfer.svg)](https://npmjs.com/@xmcl/file-transfer)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/file-transfer)](https://packagephobia.now.sh/result?p=@xmcl/file-transfer)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

A high-performance download primitive built on [undici](https://github.com/nodejs/undici).

Features:

- Parallel range requests for large files (configurable threshold and policy)
- Multi-URL fallback — try the next URL when the current one fails
- `AbortSignal` cancellation
- Customizable retry logic via the underlying undici dispatcher
- Progress tracking for single or batched downloads

> **Note on integrity checking.** This package does **not** verify
> downloaded content against a hash. Callers that need integrity
> guarantees must do their own post-download verification (see
> `@xmcl/instance` for an example) or pass an explicit dispatcher
> that enforces it.

> **Note on atomic writes.** `download()` writes directly to
> `destination`. If the download fails or the process is killed
> mid-stream, a partial file may exist at `destination`. Callers that
> need atomic semantics should download to a side path of their
> choice and rename it themselves on success — see
> `xmcl-runtime/market/downloadStaged.ts` for one such helper.

## Usage

### Single download

```ts
import { download } from '@xmcl/file-transfer'

await download({
  // Required
  url: 'http://example.com/file.zip',
  destination: '/abs/path/file.zip',

  // Optional
  headers: { 'X-Custom': 'value' },
  signal: new AbortController().signal,
  // If known up-front, helps the range scheduler decide whether to
  // open parallel range requests.
  expectedTotal: 12345678,
})
```

### Multi-URL fallback

`url` may be a list. The first URL is tried; on failure the next is
attempted. The download succeeds as soon as any URL succeeds.

```ts
import { download } from '@xmcl/file-transfer'

await download({
  url: ['http://primary.example/file.zip', 'http://mirror.example/file.zip'],
  destination: '/abs/path/file.zip',
})
```

### Batched downloads

`downloadMultiple` runs many `download` calls under one shared
dispatcher and tracker. Returns a `PromiseSettledResult` per file so
the caller can decide how to surface partial failures.

```ts
import { downloadMultiple, ProgressTrackerMultiple } from '@xmcl/file-transfer'

const tracker = new ProgressTrackerMultiple()
const results = await downloadMultiple({
  options: [
    { url: 'https://example.com/a.jar', destination: '/abs/a.jar' },
    { url: 'https://example.com/b.jar', destination: '/abs/b.jar' },
  ],
  tracker,
  signal: new AbortController().signal,
})

for (const r of results) {
  if (r.status === 'rejected') console.warn(r.reason)
}
```

### Progress tracking

```ts
import { download, ProgressTrackerSingle } from '@xmcl/file-transfer'

const tracker = new ProgressTrackerSingle()
const t = setInterval(() => {
  console.log(`${tracker.progress}/${tracker.total} ${tracker.url}`)
}, 250)
try {
  await download({
    url: 'https://example.com/big.zip',
    destination: '/abs/big.zip',
    tracker,
  })
} finally {
  clearInterval(t)
}
```

### Range request tuning

By default a file is downloaded with up to 4 parallel range requests
when its declared `expectedTotal` exceeds 5 MB. To tune:

```ts
import { download, DefaultRangePolicy } from '@xmcl/file-transfer'

await download({
  url: 'https://example.com/big.zip',
  destination: '/abs/big.zip',
  rangePolicy: new DefaultRangePolicy(
    /* rangeThreshold */ 8 * 1024 * 1024, // 8MB
    /* concurrency */ 8,
  ),
})
```

Or supply your own `RangePolicy` implementation if you need a
different chunking strategy.

### Sharing a dispatcher

Callers that issue many downloads should share a single undici
`Dispatcher` so connection pools and retry policies are reused:

```ts
import { download, getDefaultAgent } from '@xmcl/file-transfer'

const dispatcher = getDefaultAgent({ maxRetries: 5 })

await Promise.all([
  download({ url: '...', destination: '...', dispatcher }),
  download({ url: '...', destination: '...', dispatcher }),
])
```


## 🧾 Classes

<div class="definition-grid class"><a href="file-transfer/ConcurrencyDispatcher">ConcurrencyDispatcher</a><a href="file-transfer/DefaultRangePolicy">DefaultRangePolicy</a><a href="file-transfer/ManagedAbortError">ManagedAbortError</a><a href="file-transfer/ProgressTrackerMultiple">ProgressTrackerMultiple</a><a href="file-transfer/ProgressTrackerSingle">ProgressTrackerSingle</a><a href="file-transfer/RangeNotSupportedError">RangeNotSupportedError</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="file-transfer/ConcurrencyDispatcherTelemetry">ConcurrencyDispatcherTelemetry</a><a href="file-transfer/DefaultRangePolicyOptions">DefaultRangePolicyOptions</a><a href="file-transfer/DownloadBaseOptions">DownloadBaseOptions</a><a href="file-transfer/DownloadController">DownloadController</a><a href="file-transfer/DownloadMultipleOptions">DownloadMultipleOptions</a><a href="file-transfer/DownloadOptions">DownloadOptions</a><a href="file-transfer/DownloadResult">DownloadResult</a><a href="file-transfer/DownloadSample">DownloadSample</a><a href="file-transfer/ProgressTracker">ProgressTracker</a><a href="file-transfer/Range">Range</a><a href="file-transfer/RangePolicy">RangePolicy</a></div>

## 🏭 Functions

### decorateError

```ts
decorateError(err: Error, urls: string[], headers: Record<string, any>, destination: string): void
```
#### Parameters

- **err**: `Error`
- **urls**: `string[]`
- **headers**: `Record<string, any>`
- **destination**: `string`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/error.ts#L60" target="_blank" rel="noreferrer">packages/file-transfer/error.ts:60</a>
</p>


### decorateHttpError

```ts
decorateHttpError(err: Error, requestUrl: string, redirects: URL[], destinationExtension: string): void
```
Adds safe request context before an HTTP error is rejected. Unlike
``decorateError``, this runs at the handler boundary, before a rejected
promise can be observed by global exception telemetry.
#### Parameters

- **err**: `Error`
- **requestUrl**: `string`
- **redirects**: `URL[]`
- **destinationExtension**: `string`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/error.ts#L38" target="_blank" rel="noreferrer">packages/file-transfer/error.ts:38</a>
</p>


### download

```ts
download(options: DownloadOptions): Promise<void>
```
#### Parameters

- **options**: `DownloadOptions`
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L112" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:112</a>
</p>


### downloadMultiple

```ts
downloadMultiple(options: DownloadMultipleOptions): Promise<PromiseSettledResult<void>[]>
```
#### Parameters

- **options**: `DownloadMultipleOptions`
#### Return Type

- `Promise<PromiseSettledResult<void>[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L80" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:80</a>
</p>


### getDefaultAgent

```ts
getDefaultAgent(retry: RetryOptions, defaultMaxRedirections: number= 5): ComposedDispatcher
```
#### Parameters

- **retry**: `RetryOptions`
- **defaultMaxRedirections**: `number`
#### Return Type

- `ComposedDispatcher`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/agent.ts#L3" target="_blank" rel="noreferrer">packages/file-transfer/agent.ts:3</a>
</p>


### getDestinationExtension

```ts
getDestinationExtension(path: string): string
```
#### Parameters

- **path**: `string`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/error.ts#L27" target="_blank" rel="noreferrer">packages/file-transfer/error.ts:27</a>
</p>


### getDownloadBaseOptions

```ts
getDownloadBaseOptions(options: DownloadBaseOptions): { controller: DownloadController | undefined; dispatcher: Dispatcher; rangePolicy: RangePolicy }
```
#### Parameters

- **options**: `DownloadBaseOptions`
#### Return Type

- `{ controller: DownloadController | undefined; dispatcher: Dispatcher; rangePolicy: RangePolicy }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L32" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:32</a>
</p>


### isManagedAbortError

```ts
isManagedAbortError(e: unknown): e is ManagedAbortError
```
#### Parameters

- **e**: `unknown`
#### Return Type

- `e is ManagedAbortError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L221" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:221</a>
</p>


### isRangeNotSupportedError

```ts
isRangeNotSupportedError(e: unknown): e is RangeNotSupportedError
```
#### Parameters

- **e**: `unknown`
#### Return Type

- `e is RangeNotSupportedError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L242" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:242</a>
</p>


### isRangePolicy

```ts
isRangePolicy(rangeOptions: RangePolicy | DefaultRangePolicyOptions): rangeOptions is RangePolicy
```
#### Parameters

- **rangeOptions**: `RangePolicy | DefaultRangePolicyOptions`
#### Return Type

- `rangeOptions is RangePolicy`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/range_policy.ts#L17" target="_blank" rel="noreferrer">packages/file-transfer/range_policy.ts:17</a>
</p>


### resolveRangePolicy

```ts
resolveRangePolicy(rangeOptions: RangePolicy | DefaultRangePolicyOptions): RangePolicy
```
#### Parameters

- **rangeOptions**: `RangePolicy | DefaultRangePolicyOptions`
#### Return Type

- `RangePolicy`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/range_policy.ts#L26" target="_blank" rel="noreferrer">packages/file-transfer/range_policy.ts:26</a>
</p>



## ⏩ Type Aliases

### DownloadDecision

```ts
DownloadDecision: "continue" | "abort"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L45" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:45</a>
</p>


### DownloadMultipleOption

```ts
DownloadMultipleOption: Pick<DownloadOptions, "url" | "headers" | "destination" | "expectedTotal" | "controller">
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/download.ts#L67" target="_blank" rel="noreferrer">packages/file-transfer/download.ts:67</a>
</p>


### ManagedAbortReason

```ts
ManagedAbortReason: "ttfb" | "stall" | "slow" | "skip"
```
Why a connection was aborted by the controller/handler:
- ``ttfb``: connected/redirected but delivered no first byte in time.
- ``stall``: delivered a first byte then stopped making progress.
- ``slow``: making progress, but too slow vs. the learned model.
- ``skip``: source quarantine opened while this request was queued.

``ttfb`` and ``stall`` mean *no progress* (a dead/stuck mirror) and should
be abandoned fast; ``slow`` is a tuning decision.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L204" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:204</a>
</p>



