# Class ClassReader

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
ClassReader(buffer: Uint8Array, classFileOffset: number= 0, len: number= buffer.length): ClassReader
```
Constructs a new [ClassReader](ClassReader) object.
#### Parameters

- **buffer**: `Uint8Array`
- **classFileOffset**: `number`
- **len**: `number`
the length of the class data.
#### Return Type

- `ClassReader`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L165" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:165</a>
</p>


## 🏷️ Properties

### buf <Badge type="tip" text="public" />

```ts
buf: Uint8Array
```
The class to be parsed. &lt;i&gt;The content of this array must not be
modified. This field is intended for [Attribute](Attribute) sub classes, and
is normally not needed by class generators or adapters.&lt;/i&gt;
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L128" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:128</a>
</p>


### header <Badge type="tip" text="public" />

```ts
header: number
```
Start index of the class header information (access, name...) in
[#b b].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L156" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:156</a>
</p>


### EXPAND_ASM_INSNS <Badge type="warning" text="static" />

```ts
EXPAND_ASM_INSNS: number = 256
```
Flag to expand the ASM pseudo instructions into an equivalent sequence of
standard bytecode instructions. When resolving a forward jump it may
happen that the signed 2 bytes offset reserved for it is not sufficient
to store the bytecode offset. In this case the jump instruction is
replaced with a temporary ASM pseudo instruction using an unsigned 2
bytes offset (see Label#resolve). This internal flag is used to re-read
classes containing such instructions, in order to replace them with
standard instructions. In addition, when this flag is used, GOTO_W and
JSR_W are &lt;i&gt;not&lt;/i&gt; converted into GOTO and JSR, to make sure that
infinite loops where a GOTO_W is replaced with a GOTO in ClassReader and
converted back to a GOTO_W in ClassWriter cannot occur.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L121" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:121</a>
</p>


### EXPAND_FRAMES <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
EXPAND_FRAMES: number = 8
```
Flag to expand the stack map frames. By default stack map frames are
visited in their original format (i.e. "expanded" for classes whose
version is less than V1_6, and "compressed" for the other classes). If
this flag is set, stack map frames are always visited in expanded format
(this option adds a decompression/recompression step in ClassReader and
ClassWriter which degrades performances quite a lot).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L106" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:106</a>
</p>


### RESIZE <Badge type="warning" text="static" />

```ts
RESIZE: boolean = true
```
True to enable JSR_W and GOTO_W support.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L70" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:70</a>
</p>


### SKIP_CODE <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
SKIP_CODE: number = 1
```
Flag to skip method code. If this class is set &lt;code&gt;CODE&lt;/code&gt;
attribute won't be visited. This can be used, for example, to retrieve
annotations for methods and method parameters.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L77" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:77</a>
</p>


### SKIP_DEBUG <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
SKIP_DEBUG: number = 2
```
Flag to skip the debug information in the class. If this flag is set the
debug information of the class is not visited, i.e. the
[visitLocalVariable](#MethodVisitor.visitLocalVariable) and
[visitLineNumber](#MethodVisitor.visitLineNumber) methods will not be
called.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L86" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:86</a>
</p>


### SKIP_FRAMES <Badge type="warning" text="static" /> <Badge type="tip" text="public" />

```ts
SKIP_FRAMES: number = 4
```
Flag to skip the stack map frames in the class. If this flag is set the
stack map frames of the class is not visited, i.e. the
[visitFrame](#MethodVisitor.visitFrame) method will not be called.
This flag is useful when the [ClassWriter#COMPUTE_FRAMES] option is
used: it avoids visiting frames that will be ignored and recomputed from
scratch in the class writer.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L96" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:96</a>
</p>


### WRITER <Badge type="warning" text="static" />

```ts
WRITER: boolean = true
```
True to enable bytecode writing support.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L65" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:65</a>
</p>


## 🔧 Methods

### accept <Badge type="tip" text="public" />

```ts
accept(classVisitor: ClassVisitor, attrs: Attribute[]= [], flags: number= 0): void
```
Makes the given visitor visit the Java class of this [ClassReader](ClassReader).
This class is the one specified in the constructor (see
[#ClassReader(byte[]) ClassReader]).
#### Parameters

- **classVisitor**: `ClassVisitor`
the visitor that must visit this class.
- **attrs**: `Attribute[]`
prototypes of the attributes that must be parsed during the
visit of the class. Any attribute whose type is not equal to
the type of one the prototypes will not be parsed: its byte
array value will be passed unchanged to the ClassWriterConstant.
&lt;i&gt;This may corrupt it if this value contains references to
the constant pool, or has syntactic or semantic links with a
class element that has been transformed by a class adapter
between the reader and the writer&lt;/i&gt;.
- **flags**: `number`
option flags that can be used to modify the default behavior
of this class. See [#SKIP_DEBUG], [#EXPAND_FRAMES]
, [#SKIP_FRAMES], [#SKIP_CODE].
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L288" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:288</a>
</p>


### getAccess <Badge type="tip" text="public" />

```ts
getAccess(): number
```
Returns the class's access flags (see [Opcodes](Opcodes)). This value may
not reflect Deprecated and Synthetic flags when bytecode is before 1.5
and those flags are represented by attributes.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L220" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:220</a>
</p>


### getClassName <Badge type="tip" text="public" />

```ts
getClassName(): string
```
Returns the internal name of the class (see
[Type#getInternalName() getInternalName]).
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L231" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:231</a>
</p>


### getInterfaces <Badge type="tip" text="public" />

```ts
getInterfaces(): string[]
```
Returns the internal names of the class's interfaces (see
[Type#getInternalName() getInternalName]).
#### Return Type

- `string[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L256" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:256</a>
</p>


### getItem <Badge type="tip" text="public" />

```ts
getItem(item: number): number
```
Returns the start index of the constant pool item in [#b b], plus
one. &lt;i&gt;This method is intended for [Attribute](Attribute) sub classes, and is
normally not needed by class generators or adapters.&lt;/i&gt;
#### Parameters

- **item**: `number`
the index a constant pool item.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L1959" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:1959</a>
</p>


### getItemCount <Badge type="tip" text="public" />

```ts
getItemCount(): number
```
Returns the number of constant pool items in [#b b].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L1946" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:1946</a>
</p>


### getMaxStringLength <Badge type="tip" text="public" />

```ts
getMaxStringLength(): number
```
Returns the maximum length of the strings contained in the constant pool
of the class.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L1970" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:1970</a>
</p>


### getSuperName <Badge type="tip" text="public" />

```ts
getSuperName(): string
```
Returns the internal of name of the super class (see
[Type#getInternalName() getInternalName]). For interfaces, the
super class is [Object].
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L244" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:244</a>
</p>


### readByte <Badge type="tip" text="public" />

```ts
readByte(index: number): number
```
Reads a byte value in [#b b]. &lt;i&gt;This method is intended for
[Attribute](Attribute) sub classes, and is normally not needed by class
generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of the value to be read in [#b b].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L1982" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:1982</a>
</p>


### readClass <Badge type="tip" text="public" />

```ts
readClass(index: number, buf: number[]): string
```
Reads a class constant pool item in [#b b]. &lt;i&gt;This method is
intended for [Attribute](Attribute) sub classes, and is normally not needed by
class generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of an unsigned short value in [#b b],
whose value is the index of a class constant pool item.
- **buf**: `number[]`
buffer to be used to read the item. This buffer must be
sufficiently large. It is not automatically resized.
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L2130" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:2130</a>
</p>


### readConst <Badge type="tip" text="public" />

```ts
readConst(item: number, buf: number[]): any
```
Reads a numeric or string constant pool item in [#b b]. &lt;i&gt;This
method is intended for [Attribute](Attribute) sub classes, and is normally not
needed by class generators or adapters.&lt;/i&gt;
#### Parameters

- **item**: `number`
the index of a constant pool item.
- **buf**: `number[]`
buffer to be used to read the item. This buffer must be
sufficiently large. It is not automatically resized.
#### Return Type

- `any`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L2146" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:2146</a>
</p>


### readInt <Badge type="tip" text="public" />

```ts
readInt(index: number): number
```
Reads a signed int value in [#b b]. &lt;i&gt;This method is intended for
[Attribute](Attribute) sub classes, and is normally not needed by class
generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of the value to be read in [#b b].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L2022" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:2022</a>
</p>


### readLabel

```ts
readLabel(offset: number, labels: Label[]): Label
```
Returns the label corresponding to the given offset. The default
implementation of this method creates a label for the given offset if it
has not been already created.
#### Parameters

- **offset**: `number`
a bytecode offset in a method.
- **labels**: `Label[]`
the already created labels, indexed by their offset. If a
label already exists for offset this method must not create a
new one. Otherwise it must store the new label in this array.
#### Return Type

- `Label`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L1868" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:1868</a>
</p>


### readLong <Badge type="tip" text="public" />

```ts
readLong(index: number): bigint
```
Reads a signed long value in [#b b]. &lt;i&gt;This method is intended for
[Attribute](Attribute) sub classes, and is normally not needed by class
generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of the value to be read in [#b b].
#### Return Type

- `bigint`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L2041" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:2041</a>
</p>


### readShort <Badge type="tip" text="public" />

```ts
readShort(index: number): number
```
Reads a signed short value in [#b b]. &lt;i&gt;This method is intended
for [Attribute](Attribute) sub classes, and is normally not needed by class
generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of the value to be read in [#b b].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L2009" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:2009</a>
</p>


### readUnsignedShort <Badge type="tip" text="public" />

```ts
readUnsignedShort(index: number): number
```
Reads an unsigned short value in [#b b]. &lt;i&gt;This method is intended
for [Attribute](Attribute) sub classes, and is normally not needed by class
generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of the value to be read in [#b b].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L1995" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:1995</a>
</p>


### readUTF8 <Badge type="tip" text="public" />

```ts
readUTF8(index: number, buf: number[]): string
```
Reads an UTF8 string constant pool item in [#b b]. &lt;i&gt;This method
is intended for [Attribute](Attribute) sub classes, and is normally not needed
by class generators or adapters.&lt;/i&gt;
#### Parameters

- **index**: `number`
the start index of an unsigned short value in [#b b],
whose value is the index of an UTF8 constant pool item.
- **buf**: `number[]`
buffer to be used to read the item. This buffer must be
sufficiently large. It is not automatically resized.
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/ClassReader.ts#L2058" target="_blank" rel="noreferrer">packages/asm/libs/ClassReader.ts:2058</a>
</p>


