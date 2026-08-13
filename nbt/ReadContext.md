# Class ReadContext

## 🏭 Constructors

### constructor

```ts
ReadContext(schema: Schema | undefined, tagType: TagType): ReadContext
```
#### Parameters

- **schema**: `Schema | undefined`
- **tagType**: `TagType`
#### Return Type

- `ReadContext`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L623" target="_blank" rel="noreferrer">packages/nbt/index.ts:623</a>
</p>


## 🏷️ Properties

### inspect <Badge type="tip" text="public" />

```ts
inspect: Schema | undefined
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L621" target="_blank" rel="noreferrer">packages/nbt/index.ts:621</a>
</p>


### schema <Badge type="tip" text="public" />

```ts
schema: Schema | undefined
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L624" target="_blank" rel="noreferrer">packages/nbt/index.ts:624</a>
</p>


### tagType <Badge type="tip" text="public" />

```ts
tagType: TagType
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L625" target="_blank" rel="noreferrer">packages/nbt/index.ts:625</a>
</p>


## 🔑 Accessors

### decoder

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L628" target="_blank" rel="noreferrer">packages/nbt/index.ts:628</a>
</p>


## 🔧 Methods

### fork

```ts
fork(schemaOrTagType: TagType | Schema): ReadContext
```
#### Parameters

- **schemaOrTagType**: `TagType | Schema`
#### Return Type

- `ReadContext`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L635" target="_blank" rel="noreferrer">packages/nbt/index.ts:635</a>
</p>


