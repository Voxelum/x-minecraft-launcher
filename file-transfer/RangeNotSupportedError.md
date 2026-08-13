# Class RangeNotSupportedError

Thrown by a segment download when a ranged request is answered with a
full ``200`` response (the mirror ignored ``Range``). The orchestrator
catches it and falls back to a single whole-file stream so the shared
file is not corrupted by overlapping writes.
## 🏭 Constructors

### constructor

```ts
RangeNotSupportedError(): RangeNotSupportedError
```
#### Return Type

- `RangeNotSupportedError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L217" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:217</a>
</p>


## 🏷️ Properties

### [kRangeUnsupported] <Badge type="tip" text="readonly" />

```ts
[kRangeUnsupported]: true = true
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/file-transfer/controller.ts#L215" target="_blank" rel="noreferrer">packages/file-transfer/controller.ts:215</a>
</p>


