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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L469" target="_blank" rel="noreferrer">packages/installer/profile.ts:469</a>
</p>


## 🏷️ Properties

### commands <Badge type="tip" text="readonly" />

```ts
commands: string[]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L471" target="_blank" rel="noreferrer">packages/installer/profile.ts:471</a>
</p>


### exitCode <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
exitCode: number | null
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L465" target="_blank" rel="noreferrer">packages/installer/profile.ts:465</a>
</p>


### jarPath <Badge type="tip" text="readonly" />

```ts
jarPath: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L470" target="_blank" rel="noreferrer">packages/installer/profile.ts:470</a>
</p>


### name

```ts
name: string = 'PostProcessFailedError'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L490" target="_blank" rel="noreferrer">packages/installer/profile.ts:490</a>
</p>


### processor <Badge type="tip" text="readonly" />

```ts
processor: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L464" target="_blank" rel="noreferrer">packages/installer/profile.ts:464</a>
</p>


### processorOutput <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processorOutput: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L467" target="_blank" rel="noreferrer">packages/installer/profile.ts:467</a>
</p>


### processSignal <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processSignal: string | null
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L466" target="_blank" rel="noreferrer">packages/installer/profile.ts:466</a>
</p>


