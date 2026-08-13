# Nbt Module

[![npm version](https://img.shields.io/npm/v/@xmcl/nbt.svg)](https://www.npmjs.com/package/@xmcl/nbt)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/nbt.svg)](https://npmjs.com/@xmcl/nbt)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/nbt)](https://packagephobia.now.sh/result?p=@xmcl/nbt)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide function to read NBT binary format to json.

## Usage

### Read and Write NBT

You can simply deserialize/serialize nbt.

```ts
import { serialize, deserialize } from "@xmcl/nbt";
const fileData: Buffer;
// compressed = undefined will not perform compress algorithm
// compressed = true will use gzip algorithm
const compressed: true | "gzip" | "deflate" | undefined;
const readed: any = await deserialize(fileData, { compressed });
// The deserialize return object contain NBTPrototype property which define its nbt type
// After you do the modification on it, you can serialize it back to NBT
const buf: Buffer = await serialize(readed, { compressed });
```

You can use class with annotation (decorator) to serialize/deserialize the type consistently.

Suppose you are reading the [servers.dat](https://minecraft.gamepedia.com/Servers.dat_format). You can have:

```ts
import { serialize, deserialize, TagType } from "@xmcl/nbt";

class ServerInfo {
    @TagType(TagType.String)
    icon: string = "";
    @TagType(TagType.String)
    ip: string = "";
    @TagType(TagType.String)
    name: string = "";
    @TagType(TagType.Byte)
    acceptTextures: number = 0;
}

class Servers {
    @TagType([ServerInfo])
    servers: ServerInfo[] = []
}

// read
// explict tell the function to deserialize into the type Servers
const servers = await deserialize(data, { type: Servers });
const infos: ServerInfo[] = servers.servers;

// write
const servers: Servers;
const binary = await serialize(servers);
```

## 🧾 Classes

<div class="definition-grid class"><a href="nbt/ReadContext">ReadContext</a><a href="nbt/WriteContext">WriteContext</a></div>

## 🤝 Interfaces

<div class="definition-grid interface"><a href="nbt/DeserializationOption">DeserializationOption</a><a href="nbt/NBTPrototype">NBTPrototype</a><a href="nbt/SerializationOption">SerializationOption</a><a href="nbt/TagCoder">TagCoder</a></div>

## 🗃️ Namespaces

<div class="definition-grid namespace"><a href="nbt/TagType">TagType</a></div>

## 🏭 Functions

### deserialize

```ts
deserialize(fileData: Uint8Array, option: DeserializationOption<T>= {}): Promise<T>
```
Deserialize the nbt binary into json
#### Parameters

- **fileData**: `Uint8Array`
The nbt binary
- **option**: `DeserializationOption<T>`
#### Return Type

- `Promise<T>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L492" target="_blank" rel="noreferrer">packages/nbt/index.ts:492</a>
</p>


### deserializeSync

```ts
deserializeSync(fileData: Uint8Array, option: DeserializationOption<T>= {}): T
```
Deserialize the nbt binary into json
#### Parameters

- **fileData**: `Uint8Array`
The nbt binary
- **option**: `DeserializationOption<T>`
#### Return Type

- `T`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L527" target="_blank" rel="noreferrer">packages/nbt/index.ts:527</a>
</p>


### getPrototypeOf

```ts
getPrototypeOf(object: object | ((p: any[]) => any)): NBTPrototype | undefined
```
Get NBT schema for this object or a class.

If the param is a object, any modifications on this prototype will only affact this object.
If the param is a class, any modifications on this prototype will affact all object under this class
#### Parameters

- **object**: `object | ((p: any[]) => any)`
The object or class
#### Return Type

- `NBTPrototype | undefined`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L130" target="_blank" rel="noreferrer">packages/nbt/index.ts:130</a>
</p>


### serialize

```ts
serialize(object: object, option: SerializationOption= {}): Promise<Uint8Array<ArrayBufferLike>>
```
Serialzie an nbt typed json object into NBT binary
#### Parameters

- **object**: `object`
The json
- **option**: `SerializationOption`
#### Return Type

- `Promise<Uint8Array<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L475" target="_blank" rel="noreferrer">packages/nbt/index.ts:475</a>
</p>


### serializeSync

```ts
serializeSync(object: object, option: SerializationOption= {}): Uint8Array
```
Serialzie an nbt typed json object into NBT binary
#### Parameters

- **object**: `object`
The json
- **option**: `SerializationOption`
#### Return Type

- `Uint8Array`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L512" target="_blank" rel="noreferrer">packages/nbt/index.ts:512</a>
</p>


### setPrototypeOf

```ts
setPrototypeOf(object: object | ((p: any[]) => any), nbtPrototype: NBTPrototype): void
```
Set and change the NBT prototype of this object or class
#### Parameters

- **object**: `object | ((p: any[]) => any)`
A object or a class function
- **nbtPrototype**: `NBTPrototype`
The nbt prototype
#### Return Type

- `void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L140" target="_blank" rel="noreferrer">packages/nbt/index.ts:140</a>
</p>


### TagType

```ts
TagType(type: TagType | Constructor<T> | Schema): (clzPrototype: any, key: string) => void
```
Annotate the type of a field
#### Parameters

- **type**: `TagType | Constructor<T> | Schema`
#### Return Type

- `(clzPrototype: any, key: string) => void`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L68" target="_blank" rel="noreferrer">packages/nbt/index.ts:68</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L26" target="_blank" rel="noreferrer">packages/nbt/index.ts:26</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L153" target="_blank" rel="noreferrer">packages/nbt/index.ts:153</a>
</p>



## 🏷️ Variables

### kNBTConstructor <Badge type="tip" text="const" />

```ts
kNBTConstructor: typeof kNBTConstructor = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L24" target="_blank" rel="noreferrer">packages/nbt/index.ts:24</a>
</p>


### kNBTPrototype <Badge type="tip" text="const" />

```ts
kNBTPrototype: typeof kNBTPrototype = ...
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L23" target="_blank" rel="noreferrer">packages/nbt/index.ts:23</a>
</p>



## ⏩ Type Aliases

### CompoundSchema

```ts
CompoundSchema: { [key: string]: TagType | Schema }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L189" target="_blank" rel="noreferrer">packages/nbt/index.ts:189</a>
</p>


### ListSchema

```ts
ListSchema: [TagType | Schema]
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L188" target="_blank" rel="noreferrer">packages/nbt/index.ts:188</a>
</p>


### Schema

```ts
Schema: ListSchema | CompoundSchema | Constructor<any>
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L187" target="_blank" rel="noreferrer">packages/nbt/index.ts:187</a>
</p>


### TagType

```ts
TagType: TagTypePrimitive | typeof List | typeof Compound
```
Annotate the type of a field
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L68" target="_blank" rel="noreferrer">packages/nbt/index.ts:68</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L26" target="_blank" rel="noreferrer">packages/nbt/index.ts:26</a>, <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L153" target="_blank" rel="noreferrer">packages/nbt/index.ts:153</a>
</p>


### TagTypePrimitive

```ts
TagTypePrimitive: typeof End | typeof Byte | typeof Short | typeof Int | typeof Long | typeof Float | typeof Double | typeof ByteArray | typeof String | typeof IntArray | typeof LongArray
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/nbt/index.ts#L28" target="_blank" rel="noreferrer">packages/nbt/index.ts:28</a>
</p>



