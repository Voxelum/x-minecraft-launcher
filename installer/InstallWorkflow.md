# Interface InstallWorkflow

## 🔧 Methods

### next

```ts
next(): Promise<InstallPlanStep<T>>
```
Resolve the next executable stage from files produced by earlier stages.
This method may read checkpoints but must not download, spawn, or write.
#### Return Type

- `Promise<InstallPlanStep<T>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/installManifest.ts#L148" target="_blank" rel="noreferrer">packages/installer/installManifest.ts:148</a>
</p>


