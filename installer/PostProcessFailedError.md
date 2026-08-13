# Class PostProcessFailedError

## 🏭 Constructors

### constructor

```ts
PostProcessFailedError(jarPath: string, commands: string[], message: string, options: { exitCode?: number | null; output?: string; signal?: string | null }): PostProcessFailedError
```
#### Parameters

- **jarPath**: `string`
- **commands**: `string[]`
- **message**: `string`
- **options**: `{ exitCode?: number | null; output?: string; signal?: string | null }`
#### Return Type

- `PostProcessFailedError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L624" target="_blank" rel="noreferrer">packages/installer/profile.ts:624</a>
</p>


## 🏷️ Properties

### commands <Badge type="tip" text="readonly" />

```ts
commands: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L626" target="_blank" rel="noreferrer">packages/installer/profile.ts:626</a>
</p>


### exitCode <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
exitCode: number | null
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L620" target="_blank" rel="noreferrer">packages/installer/profile.ts:620</a>
</p>


### jarPath <Badge type="tip" text="readonly" />

```ts
jarPath: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L625" target="_blank" rel="noreferrer">packages/installer/profile.ts:625</a>
</p>


### name

```ts
name: string = 'PostProcessFailedError'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L649" target="_blank" rel="noreferrer">packages/installer/profile.ts:649</a>
</p>


### processor <Badge type="tip" text="readonly" />

```ts
processor: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L619" target="_blank" rel="noreferrer">packages/installer/profile.ts:619</a>
</p>


### processorOutput <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processorOutput: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L622" target="_blank" rel="noreferrer">packages/installer/profile.ts:622</a>
</p>


### processSignal <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processSignal: string | null
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L621" target="_blank" rel="noreferrer">packages/installer/profile.ts:621</a>
</p>


