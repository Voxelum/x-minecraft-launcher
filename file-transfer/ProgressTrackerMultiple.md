# Class ProgressTrackerMultiple

## 🏭 Constructors

### constructor

```ts
ProgressTrackerMultiple(): ProgressTrackerMultiple
```
#### Return Type

- `ProgressTrackerMultiple`


## 🏷️ Properties

### expectedTotal

```ts
expectedTotal: number = 0
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L9" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:9</a>
</p>


### trackers

```ts
trackers: ProgressTrackerSingle[] = []
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L8" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:8</a>
</p>


## 🔑 Accessors

### progress

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L31" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:31</a>
</p>


### total

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L26" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:26</a>
</p>


### url

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L17" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:17</a>
</p>


## 🔧 Methods

### subSingle

```ts
subSingle(): ProgressTrackerSingle
```
#### Return Type

- `ProgressTrackerSingle`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L11" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:11</a>
</p>


### toJSON

```ts
toJSON(): { progress: number; total: number; url: string }
```
#### Return Type

- `{ progress: number; total: number; url: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/progress.ts#L35" target="_blank" rel="noreferrer">packages/file-transfer/progress.ts:35</a>
</p>


