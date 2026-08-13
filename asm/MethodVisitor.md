# Class MethodVisitor

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
MethodVisitor(api: number, mv: MethodVisitor | null= null): MethodVisitor
```
Constructs a new [MethodVisitor](MethodVisitor).
#### Parameters

- **api**: `number`
the ASM API version implemented by this visitor. Must be one
of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
- **mv**: `MethodVisitor | null`
the method visitor to which this visitor must delegate method
calls. May be null.
#### Return Type

- `MethodVisitor`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L84" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:84</a>
</p>


## 🏷️ Properties

### api

```ts
api: number
```
The ASM API version implemented by this visitor. The value of this field
must be one of [Opcodes#ASM4](#Opcodes.ASM4) or [Opcodes#ASM5](#Opcodes.ASM5).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L66" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:66</a>
</p>


### mv

```ts
mv: MethodVisitor | null
```
The method visitor to which this visitor must delegate method calls. May
be null.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L72" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:72</a>
</p>


## 🔧 Methods

### visitAnnotation <Badge type="tip" text="public" />

```ts
visitAnnotation(desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation of this method.
#### Parameters

- **desc**: `string | null`
the class descriptor of the annotation class.
- **visible**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the annotation is visible at runtime.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L139" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:139</a>
</p>


### visitAnnotationDefault <Badge type="tip" text="public" />

```ts
visitAnnotationDefault(): AnnotationVisitor | null
```
Visits the default value of this annotation interface method.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L122" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:122</a>
</p>


### visitAttribute <Badge type="tip" text="public" />

```ts
visitAttribute(attr: Attribute): void
```
Visits a non standard attribute of this method.
#### Parameters

- **attr**: `Attribute`
an attribute.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L215" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:215</a>
</p>


### visitCode <Badge type="tip" text="public" />

```ts
visitCode(): void
```
Starts the visit of the method's code, if any (i.e. non abstract method).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L224" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:224</a>
</p>


### visitEnd <Badge type="tip" text="public" />

```ts
visitEnd(): void
```
Visits the end of the method. This method, which is the last one to be
called, is used to inform the visitor that all the annotations and
attributes of the method have been visited.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L925" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:925</a>
</p>


### visitFieldInsn <Badge type="tip" text="public" />

```ts
visitFieldInsn(opcode: number, owner: string, name: string | null, desc: string | null): void
```
Visits a field instruction. A field instruction is an instruction that
loads or stores the value of a field of an object.
#### Parameters

- **opcode**: `number`
the opcode of the type instruction to be visited. This opcode
is either GETSTATIC, PUTSTATIC, GETFIELD or PUTFIELD.
- **owner**: `string`
the internal name of the field's owner class (see
[Type#getInternalName() getInternalName]).
- **name**: `string | null`
the field's name.
- **desc**: `string | null`
the field's descriptor (see [Type](Type)).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L425" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:425</a>
</p>


### visitFrame <Badge type="tip" text="public" />

```ts
visitFrame(type: any, nLocal: any, local: any, nStack: any, stack: any): any
```
Visits the current state of the local variables and operand stack
elements. This method must(*) be called &lt;i&gt;just before&lt;/i&gt; any
instruction &lt;b&gt;i&lt;/b&gt; that follows an unconditional branch instruction
such as GOTO or THROW, that is the target of a jump instruction, or that
starts an exception handler block. The visited types must describe the
values of the local variables and of the operand stack elements &lt;i&gt;just
before&lt;/i&gt; &lt;b&gt;i&lt;/b&gt; is executed.&lt;br&gt;
&lt;br&gt;
(*) this is mandatory only for classes whose version is greater than or
equal to [V1_6](#Opcodes.V1_6). &lt;br&gt;
&lt;br&gt;
The frames of a method must be given either in expanded form, or in
compressed form (all frames must use the same format, i.e. you must not
mix expanded and compressed frames within a single method):
&lt;ul&gt;
&lt;li&gt;In expanded form, all frames must have the F_NEW type.&lt;/li&gt;
&lt;li&gt;In compressed form, frames are basically "deltas" from the state of
the previous frame:
&lt;ul&gt;
&lt;li&gt;[Opcodes#F_SAME](#Opcodes.F_SAME) representing frame with exactly the same
locals as the previous frame and with the empty stack.&lt;/li&gt;
&lt;li&gt;[Opcodes#F_SAME1](#Opcodes.F_SAME1) representing frame with exactly the same
locals as the previous frame and with single value on the stack (
&lt;code&gt;nStack&lt;/code&gt; is 1 and &lt;code&gt;stack[0]&lt;/code&gt; contains value for the
type of the stack item).&lt;/li&gt;
&lt;li&gt;[Opcodes#F_APPEND](#Opcodes.F_APPEND) representing frame with current locals are
the same as the locals in the previous frame, except that additional
locals are defined (&lt;code&gt;nLocal&lt;/code&gt; is 1, 2 or 3 and
&lt;code&gt;local&lt;/code&gt; elements contains values representing added types).&lt;/li&gt;
&lt;li&gt;[Opcodes#F_CHOP](#Opcodes.F_CHOP) representing frame with current locals are the
same as the locals in the previous frame, except that the last 1-3 locals
are absent and with the empty stack (&lt;code&gt;nLocals&lt;/code&gt; is 1, 2 or 3).&lt;/li&gt;
&lt;li&gt;[Opcodes#F_FULL](#Opcodes.F_FULL) representing complete frame data.&lt;/li&gt;
&lt;/ul&gt;
&lt;/li&gt;
&lt;/ul&gt;
&lt;br&gt;
In both cases the first frame, corresponding to the method's parameters
and access flags, is implicit and must not be visited. Also, it is
illegal to visit two or more frames for the same code location (i.e., at
least one instruction must be visited between two calls to visitFrame).
#### Parameters

- **type**: `any`
the type of this stack map frame. Must be
[Opcodes#F_NEW](#Opcodes.F_NEW) for expanded frames, or
[Opcodes#F_FULL](#Opcodes.F_FULL), [Opcodes#F_APPEND](#Opcodes.F_APPEND),
[Opcodes#F_CHOP](#Opcodes.F_CHOP), [Opcodes#F_SAME](#Opcodes.F_SAME) or
[Opcodes#F_APPEND](#Opcodes.F_APPEND), [Opcodes#F_SAME1](#Opcodes.F_SAME1) for
compressed frames.
- **nLocal**: `any`
the number of local variables in the visited frame.
- **local**: `any`
the local variable types in this frame. This array must not be
modified. Primitive types are represented by
[Opcodes#TOP](#Opcodes.TOP), [Opcodes#INTEGER](#Opcodes.INTEGER),
[Opcodes#FLOAT](#Opcodes.FLOAT), [Opcodes#LONG](#Opcodes.LONG),
[Opcodes#DOUBLE](#Opcodes.DOUBLE),[Opcodes#NULL](#Opcodes.NULL) or
[Opcodes#UNINITIALIZED_THIS](#Opcodes.UNINITIALIZED_THIS) (long and double are
represented by a single element). Reference types are
represented by String objects (representing internal names),
and uninitialized types by Label objects (this label
designates the NEW instruction that created this uninitialized
value).
- **nStack**: `any`
the number of operand stack elements in the visited frame.
- **stack**: `any`
the operand stack types in this frame. This array must not be
modified. Its content has the same format as the "local"
array.
#### Return Type

- `any`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L305" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:305</a>
</p>


### visitIincInsn <Badge type="tip" text="public" />

```ts
visitIincInsn(__var: number, increment: number): void
```
Visits an IINC instruction.
#### Parameters

- **__var**: `number`
- **increment**: `number`
amount to increment the local variable by.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L635" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:635</a>
</p>


### visitInsn <Badge type="tip" text="public" />

```ts
visitInsn(opcode: number): void
```
Visits a zero operand instruction.
#### Parameters

- **opcode**: `number`
the opcode of the instruction to be visited. This opcode is
either NOP, ACONST_NULL, ICONST_M1, ICONST_0, ICONST_1,
ICONST_2, ICONST_3, ICONST_4, ICONST_5, LCONST_0, LCONST_1,
FCONST_0, FCONST_1, FCONST_2, DCONST_0, DCONST_1, IALOAD,
LALOAD, FALOAD, DALOAD, AALOAD, BALOAD, CALOAD, SALOAD,
IASTORE, LASTORE, FASTORE, DASTORE, AASTORE, BASTORE, CASTORE,
SASTORE, POP, POP2, DUP, DUP_X1, DUP_X2, DUP2, DUP2_X1,
DUP2_X2, SWAP, IADD, LADD, FADD, DADD, ISUB, LSUB, FSUB, DSUB,
IMUL, LMUL, FMUL, DMUL, IDIV, LDIV, FDIV, DDIV, IREM, LREM,
FREM, DREM, INEG, LNEG, FNEG, DNEG, ISHL, LSHL, ISHR, LSHR,
IUSHR, LUSHR, IAND, LAND, IOR, LOR, IXOR, LXOR, I2L, I2F, I2D,
L2I, L2F, L2D, F2I, F2L, F2D, D2I, D2L, D2F, I2B, I2C, I2S,
LCMP, FCMPL, FCMPG, DCMPL, DCMPG, IRETURN, LRETURN, FRETURN,
DRETURN, ARETURN, RETURN, ARRAYLENGTH, ATHROW, MONITORENTER,
or MONITOREXIT.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L344" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:344</a>
</p>


### visitInsnAnnotation <Badge type="tip" text="public" />

```ts
visitInsnAnnotation(typeRef: number, typePath: TypePath | null, desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation on an instruction. This method must be called just
&lt;i&gt;after&lt;/i&gt; the annotated instruction. It can be called several times
for the same instruction.
#### Parameters

- **typeRef**: `number`
a reference to the annotated type. The sort of this type
reference must be [TypeReference#INSTANCEOF INSTANCEOF],
[TypeReference#NEW NEW],
[TypeReference#CONSTRUCTOR_REFERENCE CONSTRUCTOR_REFERENCE], [TypeReference#METHOD_REFERENCE METHOD_REFERENCE], [TypeReference#CAST CAST],
[TypeReference#CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT],
[TypeReference#METHOD_INVOCATION_TYPE_ARGUMENT METHOD_INVOCATION_TYPE_ARGUMENT],
[TypeReference#CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT], or
[TypeReference#METHOD_REFERENCE_TYPE_ARGUMENT METHOD_REFERENCE_TYPE_ARGUMENT]. See [TypeReference](TypeReference).
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L722" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:722</a>
</p>


### visitIntInsn <Badge type="tip" text="public" />

```ts
visitIntInsn(opcode: number, operand: number): void
```
Visits an instruction with a single int operand.
#### Parameters

- **opcode**: `number`
the opcode of the instruction to be visited. This opcode is
either BIPUSH, SIPUSH or NEWARRAY.
- **operand**: `number`
the operand of the instruction to be visited.&lt;br&gt;
When opcode is BIPUSH, operand value should be between
Byte.MIN_VALUE and Byte.MAX_VALUE.&lt;br&gt;
When opcode is SIPUSH, operand value should be between
Short.MIN_VALUE and Short.MAX_VALUE.&lt;br&gt;
When opcode is NEWARRAY, operand value should be one of
[Opcodes#T_BOOLEAN](#Opcodes.T_BOOLEAN), [Opcodes#T_CHAR](#Opcodes.T_CHAR),
[Opcodes#T_FLOAT](#Opcodes.T_FLOAT), [Opcodes#T_DOUBLE](#Opcodes.T_DOUBLE),
[Opcodes#T_BYTE](#Opcodes.T_BYTE), [Opcodes#T_SHORT](#Opcodes.T_SHORT),
[Opcodes#T_INT](#Opcodes.T_INT) or [Opcodes#T_LONG](#Opcodes.T_LONG).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L368" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:368</a>
</p>


### visitInvokeDynamicInsn <Badge type="tip" text="public" />

```ts
visitInvokeDynamicInsn(name: string, desc: string, bsm: Handle, bsmArgs: any[]): void
```
Visits an invokedynamic instruction.
#### Parameters

- **name**: `string`
the method's name.
- **desc**: `string`
the method's descriptor (see [Type](Type)).
- **bsm**: `Handle`
the bootstrap method.
- **bsmArgs**: `any[]`
the bootstrap method constant arguments. Each argument must be
an [Integer], [Float], [Long],
[Double], [String], [Type](Type) or [Handle](Handle)
value. This method is allowed to modify the content of the
array so a caller should expect that this array may change.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L538" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:538</a>
</p>


### visitJumpInsn <Badge type="tip" text="public" />

```ts
visitJumpInsn(opcode: number, label: Label): void
```
Visits a jump instruction. A jump instruction is an instruction that may
jump to another instruction.
#### Parameters

- **opcode**: `number`
the opcode of the type instruction to be visited. This opcode
is either IFEQ, IFNE, IFLT, IFGE, IFGT, IFLE, IF_ICMPEQ,
IF_ICMPNE, IF_ICMPLT, IF_ICMPGE, IF_ICMPGT, IF_ICMPLE,
IF_ACMPEQ, IF_ACMPNE, GOTO, JSR, IFNULL or IFNONNULL.
- **label**: `Label`
the operand of the instruction to be visited. This operand is
a label that designates the instruction to which the jump
instruction may jump.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L558" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:558</a>
</p>


### visitLabel <Badge type="tip" text="public" />

```ts
visitLabel(label: Label): void
```
Visits a label. A label designates the instruction that will be visited
just after it.
#### Parameters

- **label**: `Label`
a [Label](Label) object.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L571" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:571</a>
</p>


### visitLdcInsn <Badge type="tip" text="public" />

```ts
visitLdcInsn(cst: any): void
```
Visits a LDC instruction. Note that new constant types may be added in
future versions of the Java Virtual Machine. To easily detect new
constant types, implementations of this method should check for
unexpected constant types, like this:

&lt;pre&gt;
if (cst instanceof Integer) {
// ...
} else if (cst instanceof Float) {
// ...
} else if (cst instanceof Long) {
// ...
} else if (cst instanceof Double) {
// ...
} else if (cst instanceof String) {
// ...
} else if (cst instanceof Type) {
int sort = ((Type) cst).getSort();
if (sort == Type.OBJECT) {
// ...
} else if (sort == Type.ARRAY) {
// ...
} else if (sort == Type.METHOD) {
// ...
} else {
// throw an exception
}
} else if (cst instanceof Handle) {
// ...
} else {
// throw an exception
}
&lt;/pre&gt;
#### Parameters

- **cst**: `any`
the constant to be loaded on the stack. This parameter must be
a non null [Integer], a [Float], a [Long], a
[Double], a [String], a [Type](Type) of OBJECT or
ARRAY sort for &lt;tt&gt;.class&lt;/tt&gt; constants, for classes whose
version is 49.0, a [Type](Type) of METHOD sort or a
[Handle](Handle) for MethodType and MethodHandle constants, for
classes whose version is 51.0.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L621" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:621</a>
</p>


### visitLineNumber <Badge type="tip" text="public" />

```ts
visitLineNumber(line: number, start: Label): void
```
Visits a line number declaration.
#### Parameters

- **line**: `number`
a line number. This number refers to the source file from
which the class was compiled.
- **start**: `Label`
the first instruction corresponding to this line number.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L899" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:899</a>
</p>


### visitLocalVariable <Badge type="tip" text="public" />

```ts
visitLocalVariable(name: string | null, desc: string | null, signature: string | null, start: Label, end: Label, index: number): void
```
Visits a local variable declaration.
#### Parameters

- **name**: `string | null`
the name of a local variable.
- **desc**: `string | null`
the type descriptor of this local variable.
- **signature**: `string | null`
the type signature of this local variable. May be
&lt;tt&gt;null&lt;/tt&gt; if the local variable type does not use generic
types.
- **start**: `Label`
the first instruction corresponding to the scope of this local
variable (inclusive).
- **end**: `Label`
the last instruction corresponding to the scope of this local
variable (exclusive).
- **index**: `number`
the local variable's index.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L819" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:819</a>
</p>


### visitLocalVariableAnnotation <Badge type="tip" text="public" />

```ts
visitLocalVariableAnnotation(typeRef: number, typePath: TypePath | null, start: Label[], end: Label[], index: number[], desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation on a local variable type.
#### Parameters

- **typeRef**: `number`
a reference to the annotated type. The sort of this type
reference must be [TypeReference#LOCAL_VARIABLE LOCAL_VARIABLE] or [TypeReference#RESOURCE_VARIABLE RESOURCE_VARIABLE]. See [TypeReference](TypeReference).
- **typePath**: `TypePath | null`
the path to the annotated type argument, wildcard bound, array
element type, or static inner type within 'typeRef'. May be
&lt;tt&gt;null&lt;/tt&gt; if the annotation targets 'typeRef' as a whole.
- **start**: `Label[]`
the fist instructions corresponding to the continuous ranges
that make the scope of this local variable (inclusive).
- **end**: `Label[]`
the last instructions corresponding to the continuous ranges
that make the scope of this local variable (exclusive). This
array must have the same size as the 'start' array.
- **index**: `number[]`
the local variable's index in each range. This array must have
the same size as the 'start' array.
- **desc**: `string | null`
the class descriptor of the annotation class.
- **visible**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the annotation is visible at runtime.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L861" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:861</a>
</p>


### visitLookupSwitchInsn <Badge type="tip" text="public" />

```ts
visitLookupSwitchInsn(dflt: Label, keys: number[], labels: Label[]): void
```
Visits a LOOKUPSWITCH instruction.
#### Parameters

- **dflt**: `Label`
beginning of the default handler block.
- **keys**: `number[]`
the values of the keys.
- **labels**: `Label[]`
beginnings of the handler blocks. &lt;tt&gt;labels[i]&lt;/tt&gt; is the
beginning of the handler block for the &lt;tt&gt;keys[i]&lt;/tt&gt; key.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L671" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:671</a>
</p>


### visitMaxs <Badge type="tip" text="public" />

```ts
visitMaxs(maxStack: number, maxLocals: number): void
```
Visits the maximum stack size and the maximum number of local variables
of the method.
#### Parameters

- **maxStack**: `number`
maximum stack size of the method.
- **maxLocals**: `number`
maximum number of local variables for the method.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L914" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:914</a>
</p>


### visitMethodInsn <Badge type="tip" text="public" />

```ts
visitMethodInsn(opcode: any, owner: any, name: any, desc: any, itf: any): any
```
Visits a method instruction. A method instruction is an instruction that
invokes a method.
#### Parameters

- **opcode**: `any`
the opcode of the type instruction to be visited. This opcode
is either INVOKEVIRTUAL, INVOKESPECIAL, INVOKESTATIC or
INVOKEINTERFACE.
- **owner**: `any`
the internal name of the method's owner class (see
[Type#getInternalName() getInternalName]).
- **name**: `any`
the method's name.
- **desc**: `any`
the method's descriptor (see [Type](Type)).
- **itf**: `any`
if the method's owner class is an interface.
#### Return Type

- `any`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L481" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:481</a>
</p>


### visitMethodInsn$int$java_lang_String$java_lang_String$java_lang_String <Badge type="tip" text="public" />

```ts
visitMethodInsn$int$java_lang_String$java_lang_String$java_lang_String(opcode: number, owner: string, name: string, desc: string): void
```
Visits a method instruction. A method instruction is an instruction that
invokes a method.
#### Parameters

- **opcode**: `number`
the opcode of the type instruction to be visited. This opcode
is either INVOKEVIRTUAL, INVOKESPECIAL, INVOKESTATIC or
INVOKEINTERFACE.
- **owner**: `string`
the internal name of the method's owner class (see
[Type#getInternalName() getInternalName]).
- **name**: `string`
the method's name.
- **desc**: `string`
the method's descriptor (see [Type](Type)).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L447" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:447</a>
</p>


### visitMultiANewArrayInsn <Badge type="tip" text="public" />

```ts
visitMultiANewArrayInsn(desc: string, dims: number): void
```
Visits a MULTIANEWARRAY instruction.
#### Parameters

- **desc**: `string`
an array type descriptor (see [Type](Type)).
- **dims**: `number`
number of dimensions of the array to allocate.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L685" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:685</a>
</p>


### visitParameter <Badge type="tip" text="public" />

```ts
visitParameter(name: string | null, access: number): void
```
Visits a parameter of this method.
#### Parameters

- **name**: `string | null`
parameter name or null if none is provided.
- **access**: `number`
the parameter's access flags, only &lt;tt&gt;ACC_FINAL&lt;/tt&gt;,
&lt;tt&gt;ACC_SYNTHETIC&lt;/tt&gt; or/and &lt;tt&gt;ACC_MANDATED&lt;/tt&gt; are
allowed (see [Opcodes](Opcodes)).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L103" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:103</a>
</p>


### visitParameterAnnotation <Badge type="tip" text="public" />

```ts
visitParameterAnnotation(parameter: number, desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation of a parameter this method.
#### Parameters

- **parameter**: `number`
the parameter index.
- **desc**: `string | null`
the class descriptor of the annotation class.
- **visible**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the annotation is visible at runtime.
#### Return Type

- `AnnotationVisitor | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L198" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:198</a>
</p>


### visitTableSwitchInsn <Badge type="tip" text="public" />

```ts
visitTableSwitchInsn(min: number, max: number, dflt: Label, labels: Label[]): void
```
Visits a TABLESWITCH instruction.
#### Parameters

- **min**: `number`
the minimum key value.
- **max**: `number`
the maximum key value.
- **dflt**: `Label`
beginning of the default handler block.
- **labels**: `Label[]`
beginnings of the handler blocks. &lt;tt&gt;labels[i]&lt;/tt&gt; is the
beginning of the handler block for the &lt;tt&gt;min + i&lt;/tt&gt; key.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L654" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:654</a>
</p>


### visitTryCatchAnnotation <Badge type="tip" text="public" />

```ts
visitTryCatchAnnotation(typeRef: number, typePath: TypePath | null, desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation on an exception handler type. This method must be
called &lt;i&gt;after&lt;/i&gt; the [#visitTryCatchBlock] for the annotated
exception handler. It can be called several times for the same exception
handler.
#### Parameters

- **typeRef**: `number`
a reference to the annotated type. The sort of this type
reference must be [TypeReference#EXCEPTION_PARAMETER EXCEPTION_PARAMETER]. See [TypeReference](TypeReference).
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L781" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:781</a>
</p>


### visitTryCatchBlock <Badge type="tip" text="public" />

```ts
visitTryCatchBlock(start: Label, end: Label, handler: Label, type: string | null): void
```
Visits a try catch block.
#### Parameters

- **start**: `Label`
beginning of the exception handler's scope (inclusive).
- **end**: `Label`
end of the exception handler's scope (exclusive).
- **handler**: `Label`
beginning of the exception handler's code.
- **type**: `string | null`
internal name of the type of exceptions handled by the
handler, or &lt;tt&gt;null&lt;/tt&gt; to catch any exceptions (for
"finally" blocks).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L754" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:754</a>
</p>


### visitTypeAnnotation <Badge type="tip" text="public" />

```ts
visitTypeAnnotation(typeRef: number, typePath: TypePath | null, desc: string | null, visible: boolean): AnnotationVisitor | null
```
Visits an annotation on a type in the method signature.
#### Parameters

- **typeRef**: `number`
a reference to the annotated type. The sort of this type
reference must be [TypeReference#METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER],
[TypeReference#METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND],
[TypeReference#METHOD_RETURN METHOD_RETURN],
[TypeReference#METHOD_RECEIVER METHOD_RECEIVER],
[TypeReference#METHOD_FORMAL_PARAMETER METHOD_FORMAL_PARAMETER] or [TypeReference#THROWS THROWS]. See [TypeReference](TypeReference).
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
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L171" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:171</a>
</p>


### visitTypeInsn <Badge type="tip" text="public" />

```ts
visitTypeInsn(opcode: number, type: string): void
```
Visits a type instruction. A type instruction is an instruction that
takes the internal name of a class as parameter.
#### Parameters

- **opcode**: `number`
the opcode of the type instruction to be visited. This opcode
is either NEW, ANEWARRAY, CHECKCAST or INSTANCEOF.
- **type**: `string`
the operand of the instruction to be visited. This operand
must be the internal name of an object or array class (see
[Type#getInternalName() getInternalName]).
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L404" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:404</a>
</p>


### visitVarInsn <Badge type="tip" text="public" />

```ts
visitVarInsn(opcode: number, __var: number): void
```
Visits a local variable instruction. A local variable instruction is an
instruction that loads or stores the value of a local variable.
#### Parameters

- **opcode**: `number`
the opcode of the local variable instruction to be visited.
This opcode is either ILOAD, LLOAD, FLOAD, DLOAD, ALOAD,
ISTORE, LSTORE, FSTORE, DSTORE, ASTORE or RET.
- **__var**: `number`
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/MethodVisitor.ts#L386" target="_blank" rel="noreferrer">packages/asm/libs/MethodVisitor.ts:386</a>
</p>


