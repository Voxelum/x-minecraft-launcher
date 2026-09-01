# Class Type

A Java field or method type. This class can be used to make it easier to
manipulate type and method descriptors.
## 🏭 Constructors

### constructor

```ts
Type(sort: number, buf: string | null, off: number, len: number): Type
```
Constructs a reference type.
#### Parameters

- **sort**: `number`
the sort of the reference type to be constructed.
- **buf**: `string | null`
a buffer containing the descriptor of the previous type.
- **off**: `number`
the offset of this descriptor in the previous buffer.
- **len**: `number`
the length of this descriptor.
#### Return Type

- `Type`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L224" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:224</a>
</p>


## 🏷️ Properties

### sort <Badge type="tip" text="readonly" />

```ts
sort: number
```
The sort of this Java type.

[#VOID VOID], [#BOOLEAN BOOLEAN], [#CHAR CHAR],
[#BYTE BYTE], [#SHORT SHORT], [#INT INT],
[#FLOAT FLOAT], [#LONG LONG], [#DOUBLE DOUBLE],
[#ARRAY ARRAY], [#OBJECT OBJECT] or [#METHOD METHOD].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L195" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:195</a>
</p>


### ARRAY <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
ARRAY: number = 9
```
The sort of array reference types. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L89" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:89</a>
</p>


### BOOLEAN <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
BOOLEAN: number = 1
```
The sort of the &lt;tt&gt;boolean&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L49" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:49</a>
</p>


### BOOLEAN_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
BOOLEAN_TYPE: Type = ...
```
The &lt;tt&gt;boolean&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L114" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:114</a>
</p>


### BYTE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
BYTE: number = 3
```
The sort of the &lt;tt&gt;byte&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L59" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:59</a>
</p>


### BYTE_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
BYTE_TYPE: Type = ...
```
The &lt;tt&gt;byte&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L134" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:134</a>
</p>


### CHAR <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CHAR: number = 2
```
The sort of the &lt;tt&gt;char&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L54" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:54</a>
</p>


### CHAR_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CHAR_TYPE: Type = ...
```
The &lt;tt&gt;char&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L124" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:124</a>
</p>


### DOUBLE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
DOUBLE: number = 8
```
The sort of the &lt;tt&gt;double&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L84" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:84</a>
</p>


### DOUBLE_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
DOUBLE_TYPE: Type = ...
```
The &lt;tt&gt;double&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L179" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:179</a>
</p>


### FLOAT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
FLOAT: number = 6
```
The sort of the &lt;tt&gt;float&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L74" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:74</a>
</p>


### FLOAT_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
FLOAT_TYPE: Type = ...
```
The &lt;tt&gt;float&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L159" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:159</a>
</p>


### INT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
INT: number = 5
```
The sort of the &lt;tt&gt;int&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L69" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:69</a>
</p>


### INT_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
INT_TYPE: Type = ...
```
The &lt;tt&gt;int&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L154" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:154</a>
</p>


### LONG <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
LONG: number = 7
```
The sort of the &lt;tt&gt;long&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L79" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:79</a>
</p>


### LONG_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
LONG_TYPE: Type = ...
```
The &lt;tt&gt;long&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L169" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:169</a>
</p>


### METHOD <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD: number = 11
```
The sort of method types. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L99" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:99</a>
</p>


### OBJECT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
OBJECT: number = 10
```
The sort of object reference types. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L94" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:94</a>
</p>


### SHORT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
SHORT: number = 4
```
The sort of the &lt;tt&gt;short&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L64" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:64</a>
</p>


### SHORT_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
SHORT_TYPE: Type = ...
```
The &lt;tt&gt;short&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L144" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:144</a>
</p>


### VOID <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
VOID: number = 0
```
The sort of the &lt;tt&gt;void&lt;/tt&gt; type. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L44" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:44</a>
</p>


### VOID_TYPE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
VOID_TYPE: Type = ...
```
The &lt;tt&gt;void&lt;/tt&gt; type.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L104" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:104</a>
</p>


## 🔑 Accessors

### internalName

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L392" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:392</a>
</p>


### size

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L426" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:426</a>
</p>


## 🔧 Methods

### equals

```ts
equals(o: any): boolean
```
Tests if the given object is equal to this type.
#### Parameters

- **o**: `any`
the object to be compared to this type.
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L436" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:436</a>
</p>


### getDescriptor

```ts
getDescriptor(buf: any= ''): any
```
Appends the descriptor corresponding to this Java type to the given
string buffer.
#### Parameters

- **buf**: `any`
the string buffer to which the descriptor must be appended.
#### Return Type

- `any`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L402" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:402</a>
</p>


### hashCode

```ts
hashCode(): number
```
Returns a hash code value for this type.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L469" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:469</a>
</p>


### toString

```ts
toString(): string
```
Returns a string representation of this type.
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L484" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:484</a>
</p>


### getArgumentsAndReturnSizes <Badge type="warning" text="static" />

```ts
getArgumentsAndReturnSizes(desc: string): number
```
Computes the size of the arguments and of the return value of a method.
#### Parameters

- **desc**: `string`
the descriptor of a method.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L303" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:303</a>
</p>


### getArgumentTypes <Badge type="warning" text="static" />

```ts
getArgumentTypes(methodDescriptor: string): Type[]
```
Returns the Java types corresponding to the argument types of the given
method descriptor.
#### Parameters

- **methodDescriptor**: `string`
a method descriptor.
#### Return Type

- `Type[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L268" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:268</a>
</p>


### getMethodType <Badge type="warning" text="static" />

```ts
getMethodType(methodDescriptor: string): Type
```
Returns the Java type corresponding to the given method descriptor.
Equivalent to &lt;code&gt;Type.getType(methodDescriptor)&lt;/code&gt;.
#### Parameters

- **methodDescriptor**: `string`
a method descriptor.
#### Return Type

- `Type`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L256" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:256</a>
</p>


### getObjectType <Badge type="warning" text="static" />

```ts
getObjectType(internalName: string): Type
```
Returns the Java type corresponding to the given internal name.
#### Parameters

- **internalName**: `string`
an internal name.
#### Return Type

- `Type`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L240" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:240</a>
</p>


### getType <Badge type="warning" text="static" />

```ts
getType(str: string, off: number= 0): Type
```
Returns the Java type corresponding to the given type descriptor. For
method descriptors, buf is supposed to contain nothing more than the
descriptor itself.
#### Parameters

- **str**: `string`
- **off**: `number`
the offset of this descriptor in the previous buffer.
#### Return Type

- `Type`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Type.ts#L339" target="_blank" rel="noreferrer">packages/asm/libs/Type.ts:339</a>
</p>


