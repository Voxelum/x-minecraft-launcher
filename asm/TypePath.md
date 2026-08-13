# Class TypePath

## 🏭 Constructors

### constructor

```ts
TypePath(b: Uint8Array, offset: number): TypePath
```
Creates a new type path.
#### Parameters

- **b**: `Uint8Array`
the byte array containing the type path in Java class file
format.
- **offset**: `number`
the offset of the first byte of the type path in 'b'.
#### Return Type

- `TypePath`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L83" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:83</a>
</p>


## 🏷️ Properties

### buf

```ts
buf: Uint8Array
```
The byte array where the path is stored, in Java class file format.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L67" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:67</a>
</p>


### offset

```ts
offset: number
```
The offset of the first byte of the type path in 'b'.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L72" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:72</a>
</p>


### ARRAY_ELEMENT <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
ARRAY_ELEMENT: number = 0
```
A type path step that steps into the element type of an array type. See
[#getStep getStep].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L44" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:44</a>
</p>


### INNER_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
INNER_TYPE: number = 1
```
A type path step that steps into the nested type of a class type. See
[#getStep getStep].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L50" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:50</a>
</p>


### TYPE_ARGUMENT <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
TYPE_ARGUMENT: number = 3
```
A type path step that steps into a type argument of a generic type. See
[#getStep getStep].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L62" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:62</a>
</p>


### WILDCARD_BOUND <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
WILDCARD_BOUND: number = 2
```
A type path step that steps into the bound of a wildcard type. See
[#getStep getStep].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L56" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:56</a>
</p>


## 🔑 Accessors

### length

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L94" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:94</a>
</p>


## 🔧 Methods

### getStep <Badge type="tip" text="public" />

```ts
getStep(index: number): number
```
Returns the value of the given step of this path.
#### Parameters

- **index**: `number`
an index between 0 and [#getLength()], exclusive.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L107" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:107</a>
</p>


### getStepArgument <Badge type="tip" text="public" />

```ts
getStepArgument(index: number): number
```
Returns the index of the type argument that the given step is stepping
into. This method should only be used for steps whose value is
[#TYPE_ARGUMENT TYPE_ARGUMENT].
#### Parameters

- **index**: `number`
an index between 0 and [#getLength()], exclusive.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L121" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:121</a>
</p>


### toString <Badge type="tip" text="public" />

```ts
toString(): string
```
Returns a string representation of this type path. [#ARRAY_ELEMENT ARRAY_ELEMENT] steps are represented with '[', [#INNER_TYPE INNER_TYPE] steps with '.', [#WILDCARD_BOUND WILDCARD_BOUND] steps
with '*' and [#TYPE_ARGUMENT TYPE_ARGUMENT] steps with their type
argument index in decimal form followed by ';'.
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L176" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:176</a>
</p>


### fromString <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
fromString(typePath: string): TypePath | null
```
Converts a type path in string form, in the format used by
[#toString()], into a TypePath object.
#### Parameters

- **typePath**: `string`
a type path in string form, in the format used by
[#toString()]. May be null or empty.
#### Return Type

- `TypePath | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypePath.ts#L134" target="_blank" rel="noreferrer">packages/asm/libs/TypePath.ts:134</a>
</p>


