# Class WriteContext

## 🏭 Constructors

### constructor

```ts
WriteContext(schema: Schema | undefined, tagType: TagType): WriteContext
```
#### Parameters

- **schema**: `Schema | undefined`
- **tagType**: `TagType`
#### Return Type

- `WriteContext`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L652" target="_blank" rel="noreferrer">packages/nbt/index.ts:652</a>
</p>


## 🏷️ Properties

### schema <Badge type="tip" text="readonly" />

```ts
schema: Schema | undefined
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L653" target="_blank" rel="noreferrer">packages/nbt/index.ts:653</a>
</p>


### tagType <Badge type="tip" text="readonly" />

```ts
tagType: TagType
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L654" target="_blank" rel="noreferrer">packages/nbt/index.ts:654</a>
</p>


## 🔑 Accessors

### encoder

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L657" target="_blank" rel="noreferrer">packages/nbt/index.ts:657</a>
</p>


## 🔧 Methods

### fork

```ts
fork(schemaOrTagType: TagType | Schema): WriteContext
```
#### Parameters

- **schemaOrTagType**: `TagType | Schema`
#### Return Type

- `WriteContext`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L664" target="_blank" rel="noreferrer">packages/nbt/index.ts:664</a>
</p>


