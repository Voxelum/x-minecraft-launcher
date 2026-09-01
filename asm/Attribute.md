# Class Attribute

## 🏭 Constructors

### constructor

```ts
Attribute(type: string | null): Attribute
```
Constructs a new empty attribute.
#### Parameters

- **type**: `string | null`
the type of the attribute.
#### Return Type

- `Attribute`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L65" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:65</a>
</p>


## 🏷️ Properties

### next

```ts
next: Attribute | null = null
```
The next attribute in this attribute list. May be &lt;tt&gt;null&lt;/tt&gt;.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L57" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:57</a>
</p>


### type <Badge type="tip" text="public" />

```ts
type: string | null
```
The type of this attribute.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L47" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:47</a>
</p>


### value

```ts
value: Uint8Array
```
The raw value of this attribute, used only for unknown attributes.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L52" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:52</a>
</p>


## 🔧 Methods

### getCount

```ts
getCount(): number
```
Returns the length of the attribute list that begins with this attribute.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L186" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:186</a>
</p>


### getLabels

```ts
getLabels(): Label[] | null
```
Returns the labels corresponding to this attribute.
#### Return Type

- `Label[] | null`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L94" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:94</a>
</p>


### getSize

```ts
getSize(cw: ClassWriter, code: Uint8Array<ArrayBufferLike> | null, len: number, maxStack: number, maxLocals: number): number
```
Returns the size of all the attributes in this attribute list.
#### Parameters

- **cw**: `ClassWriter`
the class writer to be used to convert the attributes into
byte arrays, with the [#write write] method.
- **code**: `Uint8Array<ArrayBufferLike> | null`
the bytecode of the method corresponding to these code
attributes, or &lt;tt&gt;null&lt;/tt&gt; if these attributes are not code
attributes.
- **len**: `number`
the length of the bytecode of the method corresponding to
these code attributes, or &lt;tt&gt;null&lt;/tt&gt; if these attributes
are not code attributes.
- **maxStack**: `number`
the maximum stack size of the method corresponding to these
code attributes, or -1 if these attributes are not code
attributes.
- **maxLocals**: `number`
the maximum number of local variables of the method
corresponding to these code attributes, or -1 if these
attributes are not code attributes.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L221" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:221</a>
</p>


### isCodeAttribute <Badge type="tip" text="public" />

```ts
isCodeAttribute(): boolean
```
Returns &lt;tt&gt;true&lt;/tt&gt; if this type of attribute is a code attribute.
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L84" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:84</a>
</p>


### isUnknown <Badge type="tip" text="public" />

```ts
isUnknown(): boolean
```
Returns &lt;tt&gt;true&lt;/tt&gt; if this type of attribute is unknown. The default
implementation of this method always returns &lt;tt&gt;true&lt;/tt&gt;.
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L75" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:75</a>
</p>


### put

```ts
put(cw: ClassWriter, code: Uint8Array<ArrayBufferLike> | null, len: number, maxStack: number, maxLocals: number, out: ByteVector): void
```
Writes all the attributes of this attribute list in the given byte
vector.
#### Parameters

- **cw**: `ClassWriter`
the class writer to be used to convert the attributes into
byte arrays, with the [#write write] method.
- **code**: `Uint8Array<ArrayBufferLike> | null`
the bytecode of the method corresponding to these code
attributes, or &lt;tt&gt;null&lt;/tt&gt; if these attributes are not code
attributes.
- **len**: `number`
the length of the bytecode of the method corresponding to
these code attributes, or &lt;tt&gt;null&lt;/tt&gt; if these attributes
are not code attributes.
- **maxStack**: `number`
the maximum stack size of the method corresponding to these
code attributes, or -1 if these attributes are not code
attributes.
- **maxLocals**: `number`
the maximum number of local variables of the method
corresponding to these code attributes, or -1 if these
attributes are not code attributes.
- **out**: `ByteVector`
where the attributes must be written.
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L265" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:265</a>
</p>


### read

```ts
read(cr: ClassReader, off: number, len: number, buf: number[] | null, codeOff: number, labels: Label[] | null): Attribute
```
Reads a [#type type] attribute. This method must return a
&lt;i&gt;new&lt;/i&gt; [Attribute](Attribute) object, of type [#type type],
corresponding to the &lt;tt&gt;len&lt;/tt&gt; bytes starting at the given offset, in
the given class reader.
#### Parameters

- **cr**: `ClassReader`
the class that contains the attribute to be read.
- **off**: `number`
index of the first byte of the attribute's content in
[ClassReader#b cr.b]. The 6 attribute header bytes,
containing the type and the length of the attribute, are not
taken into account here.
- **len**: `number`
the length of the attribute's content.
- **buf**: `number[] | null`
buffer to be used to call [* readUTF8](#ClassReader.readUTF8), [(int,char[]) readClass](#ClassReader.readClass)
or [readConst](#ClassReader.readConst).
- **codeOff**: `number`
index of the first byte of code's attribute content in
[ClassReader#b cr.b], or -1 if the attribute to be read
is not a code attribute. The 6 attribute header bytes,
containing the type and the length of the attribute, are not
taken into account here.
- **labels**: `Label[] | null`
the labels of the method's code, or &lt;tt&gt;null&lt;/tt&gt; if the
attribute to be read is not a code attribute.
#### Return Type

- `Attribute`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L129" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:129</a>
</p>


### write

```ts
write(cw: ClassWriter, code: Uint8Array<ArrayBufferLike> | null, len: number, maxStack: number, maxLocals: number): ByteVector
```
Returns the byte array form of this attribute.
#### Parameters

- **cw**: `ClassWriter`
the class to which this attribute must be added. This
parameter can be used to add to the constant pool of this
class the items that corresponds to this attribute.
- **code**: `Uint8Array<ArrayBufferLike> | null`
the bytecode of the method corresponding to this code
attribute, or &lt;tt&gt;null&lt;/tt&gt; if this attribute is not a code
attributes.
- **len**: `number`
the length of the bytecode of the method corresponding to this
code attribute, or &lt;tt&gt;null&lt;/tt&gt; if this attribute is not a
code attribute.
- **maxStack**: `number`
the maximum stack size of the method corresponding to this
code attribute, or -1 if this attribute is not a code
attribute.
- **maxLocals**: `number`
the maximum number of local variables of the method
corresponding to this code attribute, or -1 if this attribute
is not a code attribute.
#### Return Type

- `ByteVector`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Attribute.ts#L168" target="_blank" rel="noreferrer">packages/asm/libs/Attribute.ts:168</a>
</p>


