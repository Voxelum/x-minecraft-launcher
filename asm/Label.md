# Class Label

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
Label(): Label
```
Constructs a new label.
#### Return Type

- `Label`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L233" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:233</a>
</p>


## 🏷️ Properties

### frame

```ts
frame: Frame | null = null
```
Information about the input and output stack map frames of this basic
block. This field is only used when [ClassWriter#COMPUTE_FRAMES]
option is used.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L201" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:201</a>
</p>


### info <Badge type="tip" text="public" />

```ts
info: any
```
Field used to associate user information to a label. Warning: this field
is used by the ASM tree package. In order to use it with the ASM tree
package you must override the
[org.objectweb.asm.tree.MethodNode#getLabelNode] method.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L122" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:122</a>
</p>


### inputStackTop

```ts
inputStackTop: number
```
Start of the output stack relatively to the input stack. The exact
semantics of this field depends on the algorithm that is used.

When only the maximum stack size is computed, this field is the number of
elements in the input stack.

When the stack map frames are completely computed, this field is the
offset of the first output stack element relatively to the top of the
input stack. This offset is always negative or null. A null offset means
that the output stack must be appended to the input stack. A -n offset
means that the first n output stack elements must replace the top n input
stack elements, and that the other elements must be appended to the input
stack.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L188" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:188</a>
</p>


### line

```ts
line: number
```
The line number corresponding to this label, if known. If there are
several lines, each line is stored in a separate label, all linked via
their next field (these links are created in ClassReader and removed just
before visitLabel is called, so that this does not impact the rest of the
code).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L146" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:146</a>
</p>


### next

```ts
next: Label | null = null
```
The next basic block in the basic block stack. This stack is used in the
main loop of the fix point algorithm used in the second step of the
control flow analysis algorithms. It is also used in
[#visitSubroutine] to avoid using a recursive method, and in
ClassReader to temporarily store multiple source lines for a label.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L228" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:228</a>
</p>


### outputStackMax

```ts
outputStackMax: number
```
Maximum height reached by the output stack, relatively to the top of the
input stack. This maximum is always positive or null.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L194" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:194</a>
</p>


### position

```ts
position: number
```
The position of this label in the code, if known.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L151" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:151</a>
</p>


### status

```ts
status: number
```
Flags that indicate the status of this label.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L137" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:137</a>
</p>


### successor

```ts
successor: Label
```
The successor of this label, in the order they are visited. This linked
list does not include labels used for debug info only. If
[ClassWriter#COMPUTE_FRAMES] option is used then, in addition, it
does not contain successive labels that denote the same bytecode position
(in this case only the first label appears in this list).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L210" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:210</a>
</p>


### successors

```ts
successors: Edge
```
The successors of this node in the control flow graph. These successors
are stored in a linked list of [Edge Edge] objects, linked to each
other by their [Edge#next] field.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L217" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:217</a>
</p>


### DEBUG <Badge type="warning" text="static" />

```ts
DEBUG: number = 1
```
Indicates if this label is only used for debug attributes. Such a label
is not the start of a basic block, the target of a jump instruction, or
an exception handler. It can be safely ignored in control flow graph
analysis algorithms (for optimization purposes).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L55" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:55</a>
</p>


### JSR <Badge type="warning" text="static" />

```ts
JSR: number = 128
```
Indicates if this basic block ends with a JSR instruction.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L92" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:92</a>
</p>


### PUSHED <Badge type="warning" text="static" />

```ts
PUSHED: number = 8
```
Indicates if this basic block has been pushed in the basic block stack.
See [MethodWriter#visitMaxs visitMaxs].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L71" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:71</a>
</p>


### REACHABLE <Badge type="warning" text="static" />

```ts
REACHABLE: number = 64
```
Indicates if this label corresponds to a reachable basic block.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L87" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:87</a>
</p>


### RESIZED <Badge type="warning" text="static" />

```ts
RESIZED: number = 4
```
Indicates if this label has been updated, after instruction resizing.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L65" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:65</a>
</p>


### RESOLVED <Badge type="warning" text="static" />

```ts
RESOLVED: number = 2
```
Indicates if the position of this label is known.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L60" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:60</a>
</p>


### RET <Badge type="warning" text="static" />

```ts
RET: number = 256
```
Indicates if this basic block ends with a RET instruction.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L97" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:97</a>
</p>


### STORE <Badge type="warning" text="static" />

```ts
STORE: number = 32
```
Indicates if a stack map frame must be stored for this label.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L82" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:82</a>
</p>


### SUBROUTINE <Badge type="warning" text="static" />

```ts
SUBROUTINE: number = 512
```
Indicates if this basic block is the start of a subroutine.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L102" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:102</a>
</p>


### TARGET <Badge type="warning" text="static" />

```ts
TARGET: number = 16
```
Indicates if this label is the target of a jump instruction, or the start
of an exception handler.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L77" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:77</a>
</p>


### VISITED <Badge type="warning" text="static" />

```ts
VISITED: number = 1024
```
Indicates if this subroutine basic block has been visited by a
visitSubroutine(null, ...) call.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L108" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:108</a>
</p>


### VISITED2 <Badge type="warning" text="static" />

```ts
VISITED2: number = 2048
```
Indicates if this subroutine basic block has been visited by a
visitSubroutine(!null, ...) call.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L114" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:114</a>
</p>


## 🔧 Methods

### addToSubroutine

```ts
addToSubroutine(id: number, nbSubroutines: number): void
```
Marks this basic block as belonging to the given subroutine.
#### Parameters

- **id**: `number`
a subroutine id.
- **nbSubroutines**: `number`
the total number of subroutines in the method.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L437" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:437</a>
</p>


### getFirst

```ts
getFirst(): Label
```
Returns the first label of the series to which this label belongs. For an
isolated label or for the first label in a series of successive labels,
this method returns the label itself. For other labels it returns the
first label of the series.
#### Return Type

- `Label`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L387" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:387</a>
</p>


### getOffset <Badge type="tip" text="public" />

```ts
getOffset(): number
```
Returns the offset corresponding to this label. This offset is computed
from the start of the method's bytecode. &lt;i&gt;This method is intended for
[Attribute](Attribute) sub classes, and is normally not needed by class
generators or adapters.&lt;/i&gt;
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L252" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:252</a>
</p>


### inSameSubroutine

```ts
inSameSubroutine(block: Label): boolean
```
Returns true if this basic block and the given one belong to a common
subroutine.
#### Parameters

- **block**: `Label`
another basic block.
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L415" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:415</a>
</p>


### inSubroutine

```ts
inSubroutine(id: number): boolean
```
Returns true is this basic block belongs to the given subroutine.
#### Parameters

- **id**: `number`
a subroutine id.
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L398" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:398</a>
</p>


### put

```ts
put(owner: MethodWriter, out: ByteVector, source: number, wideOffset: boolean): void
```
Puts a reference to this label in the bytecode of a method. If the
position of the label is known, the offset is computed and written
directly. Otherwise, a null offset is written and a new forward reference
is declared for this label.
#### Parameters

- **owner**: `MethodWriter`
the code writer that calls this method.
- **out**: `ByteVector`
the bytecode of the method.
- **source**: `number`
the position of first byte of the bytecode instruction that
contains this label.
- **wideOffset**: `boolean`
&lt;tt&gt;true&lt;/tt&gt; if the reference must be stored in 4 bytes, or
&lt;tt&gt;false&lt;/tt&gt; if it must be stored with 2 bytes.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L278" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:278</a>
</p>


### resolve

```ts
resolve(owner: MethodWriter, position: number, data: Uint8Array): boolean
```
Resolves all forward references to this label. This method must be called
when this label is added to the bytecode of the method, i.e. when its
position becomes known. This method fills in the blanks that where left
in the bytecode by each forward reference previously added to this label.
#### Parameters

- **owner**: `MethodWriter`
the code writer that calls this method.
- **position**: `number`
the position of this label in the bytecode.
- **data**: `Uint8Array`
the bytecode of the method.
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L345" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:345</a>
</p>


### toString <Badge type="tip" text="public" />

```ts
toString(): string
```
Returns a string representation of this label.
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L505" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:505</a>
</p>


### visitSubroutine

```ts
visitSubroutine(JSR: Label | null, id: number, nbSubroutines: number): void
```
Finds the basic blocks that belong to a given subroutine, and marks these
blocks as belonging to this subroutine. This method follows the control
flow graph to find all the blocks that are reachable from the current
block WITHOUT following any JSR target.
#### Parameters

- **JSR**: `Label | null`
a JSR block that jumps to this subroutine. If this JSR is not
null it is added to the successor of the RET blocks found in
the subroutine.
- **id**: `number`
the id of this subroutine.
- **nbSubroutines**: `number`
the total number of subroutines in the method.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Label.ts#L461" target="_blank" rel="noreferrer">packages/asm/libs/Label.ts:461</a>
</p>


