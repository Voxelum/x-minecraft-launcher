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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L653" target="_blank" rel="noreferrer">packages/installer/profile.ts:653</a>
</p>


## 🏷️ Properties

### actual <Badge type="tip" text="readonly" />

```ts
actual: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L659" target="_blank" rel="noreferrer">packages/installer/profile.ts:659</a>
</p>


### commands <Badge type="tip" text="readonly" />

```ts
commands: string[]
```
*Inherited from: `PostProcessFailedError.commands`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L626" target="_blank" rel="noreferrer">packages/installer/profile.ts:626</a>
</p>


### exitCode <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
exitCode: number | null
```
*Inherited from: `PostProcessFailedError.exitCode`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L620" target="_blank" rel="noreferrer">packages/installer/profile.ts:620</a>
</p>


### expect <Badge type="tip" text="readonly" />

```ts
expect: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L658" target="_blank" rel="noreferrer">packages/installer/profile.ts:658</a>
</p>


### file <Badge type="tip" text="readonly" />

```ts
file: string
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L657" target="_blank" rel="noreferrer">packages/installer/profile.ts:657</a>
</p>


### jarPath <Badge type="tip" text="readonly" />

```ts
jarPath: string
```
*Inherited from: `PostProcessFailedError.jarPath`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L625" target="_blank" rel="noreferrer">packages/installer/profile.ts:625</a>
</p>


### name

```ts
name: string = 'PostProcessValidationFailedError'
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L664" target="_blank" rel="noreferrer">packages/installer/profile.ts:664</a>
</p>


### processor <Badge type="tip" text="readonly" />

```ts
processor: string
```
*Inherited from: `PostProcessFailedError.processor`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L619" target="_blank" rel="noreferrer">packages/installer/profile.ts:619</a>
</p>


### processorOutput <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processorOutput: string
```
*Inherited from: `PostProcessFailedError.processorOutput`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L622" target="_blank" rel="noreferrer">packages/installer/profile.ts:622</a>
</p>


### processSignal <Badge type="info" text="optional" /> <Badge type="tip" text="readonly" />

```ts
processSignal: string | null
```
*Inherited from: `PostProcessFailedError.processSignal`*

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/installer/profile.ts#L621" target="_blank" rel="noreferrer">packages/installer/profile.ts:621</a>
</p>


