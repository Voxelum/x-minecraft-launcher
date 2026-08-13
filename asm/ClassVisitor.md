# Class ClassVisitor

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
ClassVisitor(api: number, cv: ClassVisitor | null= null): ClassVisitor
```
Constructs a new [ClassVisitor](ClassVisitor).
#### Parameters

- **api**: `number`
the ASM API version implemented by this visitor. Must be one
of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
- **cv**: `ClassVisitor | null`
the class visitor to which this visitor must delegate method
calls. May be null.
#### Return Type

- `ClassVisitor`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L70" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:70</a>
</p>


## 🏷️ Properties

### api

```ts
api: number
```
The ASM API version implemented by this visitor. The value of this field
must be one of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L52" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:52</a>
</p>


### cv

```ts
cv: ClassVisitor | null
```
The class visitor to which this visitor must delegate method calls. May
be null.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L58" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:58</a>
</p>


## 🔧 Methods

### visit <Badge type="tip" text="public" />

```ts
visit(version: number, access: number, name: string, signature: string | null, superName: string | null, interfaces: string[] | null): void
```
Visits the header of the class.
#### Parameters

- **version**: `number`
the class version.
- **access**: `number`
the class's access flags (see [Opcodes](Opcodes)). This parameter
also indicates if the class is deprecated.
- **name**: `string`
the internal name of the class (see
[Type#getInternalName() getInternalName]).
- **signature**: `string | null`
the signature of this class. May be &lt;tt&gt;null&lt;/tt&gt; if the class
is not a generic one, and does not extend or implement generic
classes or interfaces.
- **superName**: `string | null`
the internal of name of the super class (see
[Type#getInternalName() getInternalName]). For
interfaces, the super class is [Object]. May be
&lt;tt&gt;null&lt;/tt&gt;, but only for the [Object] class.
- **interfaces**: `string[] | null`
the internal names of the class's interfaces (see
[Type#getInternalName() getInternalName]). May be
&lt;tt&gt;null&lt;/tt&gt;.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L104" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:104</a>
</p>


### visitAnnotation <Badge type="tip" text="public" />

```ts
visitAnnotation(desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation of the class.
#### Parameters

- **desc**: `string | null`
the class descriptor of the annotation class.
- **visible**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the annotation is visible at runtime.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L165" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:165</a>
</p>


### visitAttribute <Badge type="tip" text="public" />

```ts
visitAttribute(attr: Attribute): void
```
Visits a non standard attribute of the class.
#### Parameters

- **attr**: `Attribute`
an attribute.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L215" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:215</a>
</p>


### visitEnd <Badge type="tip" text="public" />

```ts
visitEnd(): void
```
Visits the end of the class. This method, which is the last one to be
called, is used to inform the visitor that all the fields and methods of
the class have been visited.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L333" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:333</a>
</p>


### visitField <Badge type="tip" text="public" />

```ts
visitField(access: number, name: string, desc: string | null, signature: string | null, value: any): FieldVisitor | null
```
Visits a field of the class.
#### Parameters

- **access**: `number`
the field's access flags (see [Opcodes](Opcodes)). This parameter
also indicates if the field is synthetic and/or deprecated.
- **name**: `string`
the field's name.
- **desc**: `string | null`
the field's descriptor (see [Type](Type)).
- **signature**: `string | null`
the field's signature. May be &lt;tt&gt;null&lt;/tt&gt; if the field's
type does not use generic types.
- **value**: `any`
the field's initial value. This parameter, which may be
&lt;tt&gt;null&lt;/tt&gt; if the field does not have an initial value,
must be an [Integer], a [Float], a [Long], a
[Double] or a [String] (for &lt;tt&gt;int&lt;/tt&gt;,
&lt;tt&gt;float&lt;/tt&gt;, &lt;tt&gt;long&lt;/tt&gt; or &lt;tt&gt;String&lt;/tt&gt; fields
respectively). &lt;i&gt;This parameter is only used for static
fields&lt;/i&gt;. Its value is ignored for non static fields, which
must be initialized through bytecode instructions in
constructors or methods.
#### Return Type

- `FieldVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L277" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:277</a>
</p>


### visitInnerClass <Badge type="tip" text="public" />

```ts
visitInnerClass(name: string, outerName: string, innerName: string | null, access: number): void
```
Visits information about an inner class. This inner class is not
necessarily a member of the class being visited.
#### Parameters

- **name**: `string`
the internal name of an inner class (see
[Type#getInternalName() getInternalName]).
- **outerName**: `string`
the internal name of the class to which the inner class
belongs (see [Type#getInternalName() getInternalName]).
May be &lt;tt&gt;null&lt;/tt&gt; for not member classes.
- **innerName**: `string | null`
the (simple) name of the inner class inside its enclosing
class. May be &lt;tt&gt;null&lt;/tt&gt; for anonymous inner classes.
- **access**: `number`
the access flags of the inner class as originally declared in
the enclosing class.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L239" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:239</a>
</p>


### visitMethod <Badge type="tip" text="public" />

```ts
visitMethod(access: number, name: string, desc: string, signature: string | null, exceptions: string[] | null): MethodVisitor | null
```
Visits a method of the class. This method &lt;i&gt;must&lt;/i&gt; return a new
[MethodVisitor](MethodVisitor) instance (or &lt;tt&gt;null&lt;/tt&gt;) each time it is called,
i.e., it should not return a previously returned visitor.
#### Parameters

- **access**: `number`
the method's access flags (see [Opcodes](Opcodes)). This
parameter also indicates if the method is synthetic and/or
deprecated.
- **name**: `string`
the method's name.
- **desc**: `string`
the method's descriptor (see [Type](Type)).
- **signature**: `string | null`
the method's signature. May be &lt;tt&gt;null&lt;/tt&gt; if the method
parameters, return type and exceptions do not use generic
types.
- **exceptions**: `string[] | null`
the internal names of the method's exception classes (see
[Type#getInternalName() getInternalName]). May be
&lt;tt&gt;null&lt;/tt&gt;.
#### Return Type

- `MethodVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L315" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:315</a>
</p>


### visitOuterClass <Badge type="tip" text="public" />

```ts
visitOuterClass(owner: string, name: string | null, desc: string | null): void
```
Visits the enclosing class of the class. This method must be called only
if the class has an enclosing class.
#### Parameters

- **owner**: `string`
internal name of the enclosing class of the class.
- **name**: `string | null`
the name of the method that contains the class, or
&lt;tt&gt;null&lt;/tt&gt; if the class is not enclosed in a method of its
enclosing class.
- **desc**: `string | null`
the descriptor of the method that contains the class, or
&lt;tt&gt;null&lt;/tt&gt; if the class is not enclosed in a method of its
enclosing class.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L149" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:149</a>
</p>


### visitSource <Badge type="tip" text="public" />

```ts
visitSource(source: string | null, debug: string | null): void
```
Visits the source of the class.
#### Parameters

- **source**: `string | null`
the name of the source file from which the class was compiled.
May be &lt;tt&gt;null&lt;/tt&gt;.
- **debug**: `string | null`
additional debug information to compute the correspondance
between source and compiled elements of the class. May be
&lt;tt&gt;null&lt;/tt&gt;.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L128" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:128</a>
</p>


### visitTypeAnnotation <Badge type="tip" text="public" />

```ts
visitTypeAnnotation(typeRef: number, typePath: TypePath | null, desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation on a type in the class signature.
#### Parameters

- **typeRef**: `number`
a reference to the annotated type. The sort of this type
reference must be [TypeReference#CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER],
[TypeReference#CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND] or
[TypeReference#CLASS_EXTENDS CLASS_EXTENDS]. See
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassVisitor.ts#L194" target="_blank" rel="noreferrer">packages/asm/libs/ClassVisitor.ts:194</a>
</p>


