# Class TypeReference

A reference to a type appearing in a class, field or method declaration, or
on an instruction. Such a reference designates the part of the class where
the referenced type is appearing (e.g. an 'extends', 'implements' or 'throws'
clause, a 'new' instruction, a 'catch' clause, a type cast, a local variable
declaration, etc).
## 🏭 Constructors

### constructor

```ts
TypeReference(typeRef: number): TypeReference
```
Creates a new TypeReference.
#### Parameters

- **typeRef**: `number`
the int encoded value of the type reference, as received in a
visit method related to type annotations, like
visitTypeAnnotation.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L186" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:186</a>
</p>


## 🏷️ Properties

### CAST <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CAST: number = 71
```
The sort of type references that target the type declared in an explicit
or implicit cast instruction. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L147" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:147</a>
</p>


### CLASS_EXTENDS <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CLASS_EXTENDS: number = 16
```
The sort of type references that target the super class of a class or one
of the interfaces it implements. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L57" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:57</a>
</p>


### CLASS_TYPE_PARAMETER <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CLASS_TYPE_PARAMETER: number = 0
```
The sort of type references that target a type parameter of a generic
class. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L45" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:45</a>
</p>


### CLASS_TYPE_PARAMETER_BOUND <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CLASS_TYPE_PARAMETER_BOUND: number = 17
```
The sort of type references that target a bound of a type parameter of a
generic class. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L63" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:63</a>
</p>


### CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT: number = 72
```
The sort of type references that target a type parameter of a generic
constructor in a constructor call. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L153" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:153</a>
</p>


### CONSTRUCTOR_REFERENCE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CONSTRUCTOR_REFERENCE: number = 69
```
The sort of type references that target the receiver type of a
constructor reference. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L135" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:135</a>
</p>


### CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT: number = 74
```
The sort of type references that target a type parameter of a generic
constructor in a constructor reference. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L165" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:165</a>
</p>


### EXCEPTION_PARAMETER <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
EXCEPTION_PARAMETER: number = 66
```
The sort of type references that target the type of the exception of a
'catch' clause in a method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L117" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:117</a>
</p>


### FIELD <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
FIELD: number = 19
```
The sort of type references that target the type of a field. See
[#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L75" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:75</a>
</p>


### INSTANCEOF <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
INSTANCEOF: number = 67
```
The sort of type references that target the type declared in an
'instanceof' instruction. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L123" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:123</a>
</p>


### LOCAL_VARIABLE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
LOCAL_VARIABLE: number = 64
```
The sort of type references that target the type of a local variable in a
method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L105" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:105</a>
</p>


### METHOD_FORMAL_PARAMETER <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_FORMAL_PARAMETER: number = 22
```
The sort of type references that target the type of a formal parameter of
a method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L93" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:93</a>
</p>


### METHOD_INVOCATION_TYPE_ARGUMENT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_INVOCATION_TYPE_ARGUMENT: number = 73
```
The sort of type references that target a type parameter of a generic
method in a method call. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L159" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:159</a>
</p>


### METHOD_RECEIVER <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_RECEIVER: number = 21
```
The sort of type references that target the receiver type of a method.
See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L87" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:87</a>
</p>


### METHOD_REFERENCE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_REFERENCE: number = 70
```
The sort of type references that target the receiver type of a method
reference. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L141" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:141</a>
</p>


### METHOD_REFERENCE_TYPE_ARGUMENT <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_REFERENCE_TYPE_ARGUMENT: number = 75
```
The sort of type references that target a type parameter of a generic
method in a method reference. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L171" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:171</a>
</p>


### METHOD_RETURN <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_RETURN: number = 20
```
The sort of type references that target the return type of a method. See
[#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L81" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:81</a>
</p>


### METHOD_TYPE_PARAMETER <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_TYPE_PARAMETER: number = 1
```
The sort of type references that target a type parameter of a generic
method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L51" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:51</a>
</p>


### METHOD_TYPE_PARAMETER_BOUND <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
METHOD_TYPE_PARAMETER_BOUND: number = 18
```
The sort of type references that target a bound of a type parameter of a
generic method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L69" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:69</a>
</p>


### NEW <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
NEW: number = 68
```
The sort of type references that target the type of the object created by
a 'new' instruction. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L129" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:129</a>
</p>


### RESOURCE_VARIABLE <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
RESOURCE_VARIABLE: number = 65
```
The sort of type references that target the type of a resource variable
in a method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L111" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:111</a>
</p>


### THROWS <Badge type="warning" text="static" /> <Badge type="tip" text="readonly" />

```ts
THROWS: number = 23
```
The sort of type references that target the type of an exception declared
in the throws clause of a method. See [#getSort getSort].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L99" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:99</a>
</p>


## 🔧 Methods

### getExceptionIndex

```ts
getExceptionIndex(): number
```
Returns the index of the exception, in a 'throws' clause of a method,
whose type is referenced by this type reference. This method must only be
used for type references whose sort is [#THROWS THROWS].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L408" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:408</a>
</p>


### getFormalParameterIndex

```ts
getFormalParameterIndex(): number
```
Returns the index of the formal parameter whose type is referenced by
this type reference. This method must only be used for type references
whose sort is [#METHOD_FORMAL_PARAMETER METHOD_FORMAL_PARAMETER].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L397" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:397</a>
</p>


### getSort

```ts
getSort(): number
```
Returns the sort of this type reference.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L346" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:346</a>
</p>


### getSuperTypeIndex

```ts
getSuperTypeIndex(): number
```
Returns the index of the "super type" of a class that is referenced by
this type reference. This method must only be used for type references
whose sort is [#CLASS_EXTENDS CLASS_EXTENDS].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L386" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:386</a>
</p>


### getTryCatchBlockIndex

```ts
getTryCatchBlockIndex(): number
```
Returns the index of the try catch block (using the order in which they
are visited with visitTryCatchBlock), whose 'catch' type is referenced by
this type reference. This method must only be used for type references
whose sort is [#EXCEPTION_PARAMETER EXCEPTION_PARAMETER] .
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L420" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:420</a>
</p>


### getTypeArgumentIndex

```ts
getTypeArgumentIndex(): number
```
Returns the index of the type argument referenced by this type reference.
This method must only be used for type references whose sort is
[#CAST CAST], [#CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT],
[#METHOD_INVOCATION_TYPE_ARGUMENT METHOD_INVOCATION_TYPE_ARGUMENT],
[#CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT], or
[#METHOD_REFERENCE_TYPE_ARGUMENT METHOD_REFERENCE_TYPE_ARGUMENT].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L436" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:436</a>
</p>


### getTypeParameterBoundIndex

```ts
getTypeParameterBoundIndex(): number
```
Returns the index of the type parameter bound, within the type parameter
[#getTypeParameterIndex], referenced by this type reference. This
method must only be used for type references whose sort is
[#CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND] or
[#METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L373" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:373</a>
</p>


### getTypeParameterIndex

```ts
getTypeParameterIndex(): number
```
Returns the index of the type parameter referenced by this type
reference. This method must only be used for type references whose sort
is [#CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER],
[#METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER],
[#CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND] or
[#METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND].
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L360" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:360</a>
</p>


### getValue

```ts
getValue(): number
```
Returns the int encoded value of this type reference, suitable for use in
visit methods related to type annotations, like visitTypeAnnotation.
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L446" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:446</a>
</p>


### newExceptionReference <Badge type="warning" text="static" />

```ts
newExceptionReference(exceptionIndex: number): TypeReference
```
Returns a reference to the type of an exception, in a 'throws' clause of
a method.
#### Parameters

- **exceptionIndex**: `number`
the index of an exception in a 'throws' clause of a method.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L279" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:279</a>
</p>


### newFormalParameterReference <Badge type="warning" text="static" />

```ts
newFormalParameterReference(paramIndex: number): TypeReference
```
Returns a reference to the type of a formal parameter of a method.
#### Parameters

- **paramIndex**: `number`
the formal parameter index.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L266" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:266</a>
</p>


### newSuperTypeReference <Badge type="warning" text="static" />

```ts
newSuperTypeReference(itfIndex: number): TypeReference
```
Returns a reference to the super class or to an interface of the
'implements' clause of a class.
#### Parameters

- **itfIndex**: `number`
the index of an interface in the 'implements' clause of a
class, or -1 to reference the super class of the class.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L253" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:253</a>
</p>


### newTryCatchReference <Badge type="warning" text="static" />

```ts
newTryCatchReference(tryCatchBlockIndex: number): TypeReference
```
Returns a reference to the type of the exception declared in a 'catch'
clause of a method.
#### Parameters

- **tryCatchBlockIndex**: `number`
the index of a try catch block (using the order in which they
are visited with visitTryCatchBlock).
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L293" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:293</a>
</p>


### newTypeArgumentReference <Badge type="warning" text="static" />

```ts
newTypeArgumentReference(sort: number, argIndex: number): TypeReference
```
Returns a reference to the type of a type argument in a constructor or
method call or reference.
#### Parameters

- **sort**: `number`
[#CAST CAST],
[#CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT],
[#METHOD_INVOCATION_TYPE_ARGUMENT METHOD_INVOCATION_TYPE_ARGUMENT],
[#CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT], or
[#METHOD_REFERENCE_TYPE_ARGUMENT METHOD_REFERENCE_TYPE_ARGUMENT].
- **argIndex**: `number`
the type argument index.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L316" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:316</a>
</p>


### newTypeParameterBoundReference <Badge type="warning" text="static" />

```ts
newTypeParameterBoundReference(sort: number, paramIndex: number, boundIndex: number): TypeReference
```
Returns a reference to a type parameter bound of a generic class or
method.
#### Parameters

- **sort**: `number`
[#CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER] or
[#METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER].
- **paramIndex**: `number`
the type parameter index.
- **boundIndex**: `number`
the type bound index within the above type parameters.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L236" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:236</a>
</p>


### newTypeParameterReference <Badge type="warning" text="static" />

```ts
newTypeParameterReference(sort: number, paramIndex: number): TypeReference
```
Returns a reference to a type parameter of a generic class or method.
#### Parameters

- **sort**: `number`
[#CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER] or
[#METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER].
- **paramIndex**: `number`
the type parameter index.
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L218" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:218</a>
</p>


### newTypeReference <Badge type="warning" text="static" />

```ts
newTypeReference(sort: number): TypeReference
```
Returns a type reference of the given sort.
#### Parameters

- **sort**: `number`
[#FIELD FIELD], [#METHOD_RETURN METHOD_RETURN],
[#METHOD_RECEIVER METHOD_RECEIVER],
[#LOCAL_VARIABLE LOCAL_VARIABLE],
[#RESOURCE_VARIABLE RESOURCE_VARIABLE],
[#INSTANCEOF INSTANCEOF], [#NEW NEW],
[#CONSTRUCTOR_REFERENCE CONSTRUCTOR_REFERENCE], or
[#METHOD_REFERENCE METHOD_REFERENCE].
#### Return Type

- `TypeReference`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/TypeReference.ts#L204" target="_blank" rel="noreferrer">packages/asm/libs/TypeReference.ts:204</a>
</p>


