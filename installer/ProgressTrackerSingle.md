# Class ProgressTrackerSingle

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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L12" target="_blank" rel="noreferrer">packages/installer/tracker.ts:12</a>
</p>


## 🏷️ Properties

### accessor <Badge type="info" text="optional" />

```ts
accessor: ProgressTracker
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L8" target="_blank" rel="noreferrer">packages/installer/tracker.ts:8</a>
</p>


### done

```ts
done: boolean = false
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L10" target="_blank" rel="noreferrer">packages/installer/tracker.ts:10</a>
</p>


### expectedTotal

```ts
expectedTotal: number = 0
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L9" target="_blank" rel="noreferrer">packages/installer/tracker.ts:9</a>
</p>


### onDownload <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
onDownload: (accessor: ProgressTracker) => void
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L12" target="_blank" rel="noreferrer">packages/installer/tracker.ts:12</a>
</p>


## 🔑 Accessors

### progress

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L19" target="_blank" rel="noreferrer">packages/installer/tracker.ts:19</a>
</p>


### total

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L20" target="_blank" rel="noreferrer">packages/installer/tracker.ts:20</a>
</p>


### url

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L21" target="_blank" rel="noreferrer">packages/installer/tracker.ts:21</a>
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L14" target="_blank" rel="noreferrer">packages/installer/tracker.ts:14</a>
</p>


### toJSON

```ts
toJSON(): { progress: number; total: number; url: string }
```
#### Return Type

- `{ progress: number; total: number; url: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L22" target="_blank" rel="noreferrer">packages/installer/tracker.ts:22</a>
</p>


