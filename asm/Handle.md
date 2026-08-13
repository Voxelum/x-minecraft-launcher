# Class Handle

## 🏭 Constructors

### constructor <Badge type="tip" text="public" />

```ts
Handle(tag: number, owner: string, name: string, desc: string, itf: boolean= ...): Handle
```
Constructs a new field or method handle.
#### Parameters

- **tag**: `number`
the kind of field or method designated by this Handle. Must be
[Opcodes#H_GETFIELD](#Opcodes.H_GETFIELD), [Opcodes#H_GETSTATIC](#Opcodes.H_GETSTATIC),
[Opcodes#H_PUTFIELD](#Opcodes.H_PUTFIELD), [Opcodes#H_PUTSTATIC](#Opcodes.H_PUTSTATIC),
[Opcodes#H_INVOKEVIRTUAL](#Opcodes.H_INVOKEVIRTUAL),
[Opcodes#H_INVOKESTATIC](#Opcodes.H_INVOKESTATIC),
[Opcodes#H_INVOKESPECIAL](#Opcodes.H_INVOKESPECIAL),
[Opcodes#H_NEWINVOKESPECIAL](#Opcodes.H_NEWINVOKESPECIAL) or
[Opcodes#H_INVOKEINTERFACE](#Opcodes.H_INVOKEINTERFACE).
- **owner**: `string`
the internal name of the class that owns the field or method
designated by this handle.
- **name**: `string`
the name of the field or method designated by this handle.
- **desc**: `string`
the descriptor of the field or method designated by this
handle.
- **itf**: `boolean`
true if the owner is an interface.
#### Return Type

- `Handle`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L93" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:93</a>
</p>


## 🏷️ Properties

### descriptor <Badge type="tip" text="readonly" />

```ts
descriptor: string
```
The descriptor of the field or method designated by this handle.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L63" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:63</a>
</p>


### isInterface <Badge type="tip" text="readonly" />

```ts
isInterface: boolean
```
Indicate if the owner is an interface or not.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L68" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:68</a>
</p>


### name <Badge type="tip" text="readonly" />

```ts
name: string
```
The name of the field or method designated by this handle.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L58" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:58</a>
</p>


### owner <Badge type="tip" text="readonly" />

```ts
owner: string
```
The internal name of the class that owns the field or method designated
by this handle.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L53" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:53</a>
</p>


### tag <Badge type="tip" text="readonly" />

```ts
tag: number
```
The kind of field or method designated by this Handle. Should be
[Opcodes#H_GETFIELD](#Opcodes.H_GETFIELD), [Opcodes#H_GETSTATIC](#Opcodes.H_GETSTATIC),
[Opcodes#H_PUTFIELD](#Opcodes.H_PUTFIELD), [Opcodes#H_PUTSTATIC](#Opcodes.H_PUTSTATIC),
[Opcodes#H_INVOKEVIRTUAL](#Opcodes.H_INVOKEVIRTUAL), [Opcodes#H_INVOKESTATIC](#Opcodes.H_INVOKESTATIC),
[Opcodes#H_INVOKESPECIAL](#Opcodes.H_INVOKESPECIAL), [Opcodes#H_NEWINVOKESPECIAL](#Opcodes.H_NEWINVOKESPECIAL) or
[Opcodes#H_INVOKEINTERFACE](#Opcodes.H_INVOKEINTERFACE).
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L47" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:47</a>
</p>


## 🔧 Methods

### equals <Badge type="tip" text="public" />

```ts
equals(obj: any): boolean
```
#### Parameters

- **obj**: `any`
#### Return Type

- `boolean`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L107" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:107</a>
</p>


### hashCode <Badge type="tip" text="public" />

```ts
hashCode(): number
```
#### Return Type

- `number`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L124" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:124</a>
</p>


### toString <Badge type="tip" text="public" />

```ts
toString(): string
```
Returns the textual representation of this handle. The textual
representation is:

&lt;pre&gt;
for a reference to a class:
owner '.' name desc ' ' '(' tag ')'
for a reference to an interface:
owner '.' name desc ' ' '(' tag ' ' itf ')'
&lt;/pre&gt;

. As this format is unambiguous, it can be parsed if necessary.
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Handle.ts#L145" target="_blank" rel="noreferrer">packages/asm/libs/Handle.ts:145</a>
</p>


