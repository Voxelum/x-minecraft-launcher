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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L214" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:214</a>
</p>


## 🏷️ Properties

### [kManagedAbort] <Badge type="tip" text="readonly" />

```ts
[kManagedAbort]: true = true
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L211" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:211</a>
</p>


### reason <Badge type="tip" text="readonly" />

```ts
reason: ManagedAbortReason
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L212" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:212</a>
</p>


