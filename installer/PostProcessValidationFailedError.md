# Class PostProcessValidationFailedError

## 🏭 Constructors

### constructor

```ts
PostProcessValidationFailedError(jarPath: string, commands: string[], message: string, file: string, expect: string, actual: string): PostProcessValidationFailedError
```
#### Parameters

- **jarPath**: `string`
- **commands**: `string[]`
- **message**: `string`
- **file**: `string`
- **expect**: `string`
- **actual**: `string`
#### Return Type

- `PostProcessValidationFailedError`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L494" target="_blank" rel="noreferrer">packages/installer/profile.ts:494</a>
</p>


## 🏷️ Properties

### actual <Badge type="tip" text="readonly" />

```ts
actual: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L500" target="_blank" rel="noreferrer">packages/installer/profile.ts:500</a>
</p>


### commands <Badge type="tip" text="readonly" />

```ts
commands: string[]
```
*Inherited from: `PostProcessFailedError.commands`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L471" target="_blank" rel="noreferrer">packages/installer/profile.ts:471</a>
</p>


### exitCode <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
exitCode: number | null
```
*Inherited from: `PostProcessFailedError.exitCode`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L465" target="_blank" rel="noreferrer">packages/installer/profile.ts:465</a>
</p>


### expect <Badge type="tip" text="readonly" />

```ts
expect: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L499" target="_blank" rel="noreferrer">packages/installer/profile.ts:499</a>
</p>


### file <Badge type="tip" text="readonly" />

```ts
file: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L498" target="_blank" rel="noreferrer">packages/installer/profile.ts:498</a>
</p>


### jarPath <Badge type="tip" text="readonly" />

```ts
jarPath: string
```
*Inherited from: `PostProcessFailedError.jarPath`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L470" target="_blank" rel="noreferrer">packages/installer/profile.ts:470</a>
</p>


### name

```ts
name: string = 'PostProcessValidationFailedError'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L505" target="_blank" rel="noreferrer">packages/installer/profile.ts:505</a>
</p>


### processor <Badge type="tip" text="readonly" />

```ts
processor: string
```
*Inherited from: `PostProcessFailedError.processor`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L464" target="_blank" rel="noreferrer">packages/installer/profile.ts:464</a>
</p>


### processorOutput <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processorOutput: string
```
*Inherited from: `PostProcessFailedError.processorOutput`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L467" target="_blank" rel="noreferrer">packages/installer/profile.ts:467</a>
</p>


### processSignal <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processSignal: string | null
```
*Inherited from: `PostProcessFailedError.processSignal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L466" target="_blank" rel="noreferrer">packages/installer/profile.ts:466</a>
</p>


