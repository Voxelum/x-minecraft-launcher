# Class AnnotationVisitor

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
AnnotationVisitor(api: number, av: AnnotationVisitor | null= null): AnnotationVisitor
```
Constructs a new [AnnotationVisitor](AnnotationVisitor).
#### Parameters

- **api**: `number`
the ASM API version implemented by this visitor. Must be one
of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
- **av**: `AnnotationVisitor | null`
the annotation visitor to which this visitor must delegate
method calls. May be null.
#### Return Type

- `AnnotationVisitor`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L64" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:64</a>
</p>


## 🏷️ Properties

### api

```ts
api: number
```
The ASM API version implemented by this visitor. The value of this field
must be one of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L46" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:46</a>
</p>


### av

```ts
av: AnnotationVisitor | null
```
The annotation visitor to which this visitor must delegate method calls.
May be null.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L52" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:52</a>
</p>


## 🔧 Methods

### visit <Badge type="tip" text="public" />

```ts
visit(name: string, value: any): void
```
Visits a primitive value of the annotation.
#### Parameters

- **name**: `string`
the value name.
- **value**: `any`
the actual value, whose type must be [Byte],
[Boolean], [Character], [Short],
[Integer] , [Long], [Float], [Double],
[String] or [Type](Type) of OBJECT or ARRAY sort. This
value can also be an array of byte, boolean, short, char, int,
long, float or double values (this is equivalent to using
[#visitArray visitArray] and visiting each array element
in turn, but is more convenient).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L88" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:88</a>
</p>


### visitAnnotation <Badge type="tip" text="public" />

```ts
visitAnnotation(name: string, desc: string): AnnotationVisitor | null
```
Visits a nested annotation value of the annotation.
#### Parameters

- **name**: `string`
the value name.
- **desc**: `string`
the class descriptor of the nested annotation class.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L123" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:123</a>
</p>


### visitArray <Badge type="tip" text="public" />

```ts
visitArray(name: string): AnnotationVisitor | null
```
Visits an array value of the annotation. Note that arrays of primitive
types (such as byte, boolean, short, char, int, long, float or double)
can be passed as value to [#visit visit]. This is what
[ClassReader](ClassReader) does.
#### Parameters

- **name**: `string`
the value name.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L144" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:144</a>
</p>


### visitEnd <Badge type="tip" text="public" />

```ts
visitEnd(): void
```
Visits the end of the annotation.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L154" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:154</a>
</p>


### visitEnum <Badge type="tip" text="public" />

```ts
visitEnum(name: string, desc: string | null, value: string | null): void
```
Visits an enumeration value of the annotation.
#### Parameters

- **name**: `string`
the value name.
- **desc**: `string | null`
the class descriptor of the enumeration class.
- **value**: `string | null`
the actual enumeration value.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/AnnotationVisitor.ts#L104" target="_blank" rel="noreferrer">packages/asm/libs/AnnotationVisitor.ts:104</a>
</p>


