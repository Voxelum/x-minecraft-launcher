# Class ManagedAbortError

Error used to signal a controller-requested abort. ``download``
recognises it and resumes the transfer instead of failing.
## 🏭 Constructors

### constructor

```ts
ManagedAbortError(reason: ManagedAbortReason= 'slow'): ManagedAbortError
```
#### Parameters

- **reason**: `ManagedAbortReason`
#### Return Type

- `ManagedAbortError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L195" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:195</a>
</p>


## 🏷️ Properties

### [kManagedAbort] <Badge type="tip" text="readonly" />

```ts
[kManagedAbort]: true = true
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L192" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:192</a>
</p>


### reason <Badge type="tip" text="readonly" />

```ts
reason: ManagedAbortReason
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L193" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:193</a>
</p>


