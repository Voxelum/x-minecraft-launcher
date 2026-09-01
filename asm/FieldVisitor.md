# Class FieldVisitor

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
FieldVisitor(api: number, fv: FieldVisitor | null= null): FieldVisitor
```
Constructs a new [FieldVisitor](FieldVisitor).
#### Parameters

- **api**: `number`
the ASM API version implemented by this visitor. Must be one
of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
- **fv**: `FieldVisitor | null`
the field visitor to which this visitor must delegate method
calls. May be null.
#### Return Type

- `FieldVisitor`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L66" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:66</a>
</p>


## 🏷️ Properties

### api

```ts
api: number
```
The ASM API version implemented by this visitor. The value of this field
must be one of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L48" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:48</a>
</p>


### fv

```ts
fv: FieldVisitor | null
```
The field visitor to which this visitor must delegate method calls. May
be null.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L54" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:54</a>
</p>


## 🔧 Methods

### visitAnnotation <Badge type="tip" text="public" />

```ts
visitAnnotation(desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation of the field.
#### Parameters

- **desc**: `string | null`
the class descriptor of the annotation class.
- **visible**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the annotation is visible at runtime.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L85" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:85</a>
</p>


### visitAttribute <Badge type="tip" text="public" />

```ts
visitAttribute(attr: Attribute): void
```
Visits a non standard attribute of the field.
#### Parameters

- **attr**: `Attribute`
an attribute.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L131" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:131</a>
</p>


### visitEnd <Badge type="tip" text="public" />

```ts
visitEnd(): void
```
Visits the end of the field. This method, which is the last one to be
called, is used to inform the visitor that all the annotations and
attributes of the field have been visited.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L142" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:142</a>
</p>


### visitTypeAnnotation <Badge type="tip" text="public" />

```ts
visitTypeAnnotation(typeRef: number, typePath: TypePath | null, desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation on the type of the field.
#### Parameters

- **typeRef**: `number`
a reference to the annotated type. The sort of this type
reference must be [TypeReference#FIELD FIELD]. See
[TypeReference](TypeReference).
- **typePath**: `TypePath | null`
the path to the annotated type argument, wildcard bound, array
element type, or static inner type within 'typeRef'. May be
&lt;tt&gt;null&lt;/tt&gt; if the annotation targets 'typeRef' as a whole.
- **desc**: `string | null`
the class descriptor of the annotation class.
- **visible**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the annotation is visible at runtime.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/FieldVisitor.ts#L110" target="_blank" rel="noreferrer">packages/asm/libs/FieldVisitor.ts:110</a>
</p>


