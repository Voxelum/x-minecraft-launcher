# Class ConcurrencyDispatcher

## 🏭 Constructors

### constructor

```ts
ConcurrencyDispatcher(dispatcher: Dispatcher, getConcurrency: () => number): ConcurrencyDispatcher
```
#### Parameters

- **dispatcher**: `Dispatcher`
- **getConcurrency**: `() => number`
#### Return Type

- `ConcurrencyDispatcher`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L33" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:33</a>
</p>


## 🏷️ Properties

### dispatcher <Badge type="tip" text="readonly" />

```ts
dispatcher: Dispatcher
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L34" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:34</a>
</p>


## 🔑 Accessors

### active

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L40" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:40</a>
</p>


### limit

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L48" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:48</a>
</p>


### pending

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L44" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:44</a>
</p>


## 🔧 Methods

### close

```ts
close(callback: () => void): void
```
Closes the client and gracefully waits for enqueued requests to complete before invoking the callback (or returning a promise if no callback is provided).
#### Parameters

- **callback**: `() => void`
#### Return Type

- `void`

```ts
close(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L67" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:67</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L68" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:68</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L69" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:69</a>
</p>


### destroy

```ts
destroy(err: Error | null, callback: () => void): void
```
Destroy the client abruptly with the given err. All the pending and running requests will be asynchronously aborted and error. Waits until socket is closed before invoking the callback (or returning a promise if no callback is provided). Since this operation is asynchronously dispatched there might still be some progress on dispatched requests.
#### Parameters

- **err**: `Error | null`
- **callback**: `() => void`
#### Return Type

- `void`

```ts
destroy(callback: () => void): void
```
#### Parameters

- **callback**: `() => void`
#### Return Type

- `void`

```ts
destroy(err: Error | null): Promise<void>
```
#### Parameters

- **err**: `Error | null`
#### Return Type

- `Promise<void>`

```ts
destroy(): Promise<void>
```
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L78" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:78</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L79" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:79</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L80" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:80</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L81" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:81</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L82" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:82</a>
</p>


### dispatch

```ts
dispatch(options: DispatchOptions, handler: DispatchHandler): boolean
```
Dispatches a request. This API is expected to evolve through semver-major versions and is less stable than the preceding higher level APIs. It is primarily intended for library developers who implement higher level APIs on top of this.
#### Parameters

- **options**: `DispatchOptions`
- **handler**: `DispatchHandler`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L52" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:52</a>
</p>


### telemetrySnapshot

```ts
telemetrySnapshot(): ConcurrencyDispatcherTelemetry | undefined
```
#### Return Type

- `ConcurrencyDispatcherTelemetry | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/concurrency_dispatcher.ts#L93" target="_blank" rel="noreferrer">packages/file-transfer/concurrency_dispatcher.ts:93</a>
</p>


