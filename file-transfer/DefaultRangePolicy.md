# Class DefaultRangePolicy

## 🏭 Constructors

### constructor

```ts
DefaultRangePolicy(rangeThreshold: number, concurrency: number): DefaultRangePolicy
```
#### Parameters

- **rangeThreshold**: `number`
- **concurrency**: `number`
#### Return Type

- `DefaultRangePolicy`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/range_policy.ts#L45" target="_blank" rel="noreferrer">packages/file-transfer/range_policy.ts:45</a>
</p>


## 🏷️ Properties

### concurrency <Badge type="tip" text="public" />

```ts
concurrency: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/range_policy.ts#L47" target="_blank" rel="noreferrer">packages/file-transfer/range_policy.ts:47</a>
</p>


### rangeThreshold <Badge type="tip" text="public" />

```ts
rangeThreshold: number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/range_policy.ts#L46" target="_blank" rel="noreferrer">packages/file-transfer/range_policy.ts:46</a>
</p>


## 🔧 Methods

### computeRangesInRange

```ts
computeRangesInRange(start: number, end: number): Range[]
```
Compute ranges for a specific portion of the file.
#### Parameters

- **start**: `number`
The start position (inclusive)
- **end**: `number`
The end position (inclusive)
#### Return Type

- `Range[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/range_policy.ts#L50" target="_blank" rel="noreferrer">packages/file-transfer/range_policy.ts:50</a>
</p>


