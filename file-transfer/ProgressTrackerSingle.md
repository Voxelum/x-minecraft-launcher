# Class ProgressTrackerSingle

Track progress of a download
## 🏭 Constructors

### constructor

```ts
ProgressTrackerSingle(onDownload: (accessor: ProgressTracker) => void): ProgressTrackerSingle
```
#### Parameters

- **onDownload**: `(accessor: ProgressTracker) => void`
#### Return Type

- `ProgressTrackerSingle`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L53" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:53</a>
</p>


## 🏷️ Properties

### accessor <Badge type="info" text="optional" />

```ts
accessor: ProgressTracker
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L48" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:48</a>
</p>


### done

```ts
done: boolean = false
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L51" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:51</a>
</p>


### expectedTotal

```ts
expectedTotal: number = 0
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L49" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:49</a>
</p>


### onDownload <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
onDownload: (accessor: ProgressTracker) => void
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L53" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:53</a>
</p>


## 🔑 Accessors

### progress

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L65" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:65</a>
</p>


### total

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L69" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:69</a>
</p>


### url

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L73" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:73</a>
</p>


## 🔧 Methods

### setAccessor

```ts
setAccessor(accessor: ProgressTracker): void
```
#### Parameters

- **accessor**: `ProgressTracker`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L55" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:55</a>
</p>


### toJSON

```ts
toJSON(): { progress: number; total: number; url: string }
```
#### Return Type

- `{ progress: number; total: number; url: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L77" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:77</a>
</p>


