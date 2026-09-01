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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L27" target="_blank" rel="noreferrer">packages/installer/tracker.ts:27</a>
</p>


### trackers

```ts
trackers: ProgressTrackerSingle[] = []
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L26" target="_blank" rel="noreferrer">packages/installer/tracker.ts:26</a>
</p>


## 🔑 Accessors

### progress

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L39" target="_blank" rel="noreferrer">packages/installer/tracker.ts:39</a>
</p>


### total

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L36" target="_blank" rel="noreferrer">packages/installer/tracker.ts:36</a>
</p>


### url

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L35" target="_blank" rel="noreferrer">packages/installer/tracker.ts:35</a>
</p>


## 🔧 Methods

### subSingle

```ts
subSingle(): ProgressTrackerSingle
```
#### Return Type

- `ProgressTrackerSingle`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L29" target="_blank" rel="noreferrer">packages/installer/tracker.ts:29</a>
</p>


### toJSON

```ts
toJSON(): { progress: number; total: number; url: string }
```
#### Return Type

- `{ progress: number; total: number; url: string }`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/tracker.ts#L42" target="_blank" rel="noreferrer">packages/installer/tracker.ts:42</a>
</p>


