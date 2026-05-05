/**
 * The nbt module provides nbt {@link serialize} and {@link deserialize} functions.
 *
 * @packageDocumentation
 * @module @xmcl/nbt
 */

import { ByteBuffer } from '@xmcl/bytebuffer'
import { readUTF8, writeUTF8 } from './utils'
import {
  ungzip,
  inflate,
  gunzipSync,
  gzip,
  gzipSync,
  inflateSync,
  deflateSync,
  deflate,
} from './zlib'

type Constructor<T> = new (...args: any) => T

export const kNBTPrototype = Symbol('NBTPrototype')
export const kNBTConstructor = Symbol('NBTConstructor')

export type TagType = TagTypePrimitive | typeof TagType.List | typeof TagType.Compound

export type TagTypePrimitive =
  | typeof TagType.End
  | typeof TagType.Byte
  | typeof TagType.Short
  | typeof TagType.Int
  | typeof TagType.Long
  | typeof TagType.Float
  | typeof TagType.Double
  | typeof TagType.ByteArray
  | typeof TagType.String
  | typeof TagType.IntArray
  | typeof TagType.LongArray

/**
 * Ensure the plain object or prototype object has correctly setup the NBTPrototype.
 *
 * @returns The NBTPrototype object
 */
function ensurePrototype(object: object & { constructor?: Constructor<any> }) {
  let nbtPrototype = getPrototypeOf(object)
  // no prototype, create linked structure
  if (!nbtPrototype) {
    nbtPrototype = createPrototypeObject({}, object.constructor)
    // link the prototype chain
    setPrototypeOf(object, nbtPrototype)

    // link the parent prototype chain
    const parentProtoType = Object.getPrototypeOf(object)
    if (parentProtoType !== Object.prototype) {
      const parentPrototype = ensurePrototype(parentProtoType)
      Object.setPrototypeOf(nbtPrototype, parentPrototype)
    }
  }
  return nbtPrototype
}

/**
 * Annotate the type of a field
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export function TagType<T>(type: TagType | Constructor<T> | Schema) {
  return (clzPrototype: any, key: string) => {
    const nbtPrototype = ensurePrototype(clzPrototype)
    nbtPrototype[key] = type
  }
}

/**
 * Construct the object from schema or constructor.
 *
 * - If pass-in value type is a schema object, it create a prototype with constructor constructing the object with this schema as NBTPrototype.
 * - If pass-in value is a constructor, it will try to take the NBTPrototype on the constructor to create object.
 */
function constructObject(valueType: CompoundSchema | Constructor<any> | undefined): any {
  if (!valueType) {
    return {}
  }
  const prot =
    typeof valueType === 'object' ? createPrototypeObject(valueType) : getPrototypeOf(valueType)
  if (prot) return prot[kNBTConstructor]()
  if (!prot) {
    // value is constructor but no tag decodated yet.
    // in this case we just return a empty object.
    return {}
  }
}

function createPrototypeObject(
  schema: CompoundSchema,
  constructor?: Constructor<any>,
): NBTPrototype {
  const proto: any = {
    ...schema,
  }
  Object.defineProperty(proto, kNBTConstructor, {
    value: () => {
      let object: any
      if (constructor) {
        try {
          object = new constructor()
        } catch {
          object = {}
          Object.setPrototypeOf(object, constructor.prototype)
        }
      } else {
        object = {}
      }
      Object.defineProperty(object, kNBTPrototype, { value: proto })
      return object
    },
  })
  return proto
}

/**
 * Get NBT schema for this object or a class.
 *
 * If the param is a object, any modifications on this prototype will only affact this object.
 * If the param is a class, any modifications on this prototype will affact all object under this class
 *
 * @param object The object or class
 */
export function getPrototypeOf(object: object | ((...p: any[]) => any)): NBTPrototype | undefined {
  const targetObject = typeof object === 'function' ? object.prototype : object
  return targetObject[kNBTPrototype]
}

/**
 * Set and change the NBT prototype of this object or class
 * @param object A object or a class function
 * @param nbtPrototype The nbt prototype
 */
export function setPrototypeOf(
  object: object | ((...p: any[]) => any),
  nbtPrototype: NBTPrototype,
) {
  const target = typeof object === 'function' ? object.prototype : object
  Object.defineProperty(target, kNBTPrototype, { value: nbtPrototype })
}

function isTagType(n: number): n is TagType {
  return n >= 0 && n <= 12
}

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-redeclare
export namespace TagType {
  export const End = 0 as const
  export const Byte = 1 as const
  export const Short = 2 as const
  export const Int = 3 as const
  export const Long = 4 as const
  export const Float = 5 as const
  export const Double = 6 as const
  export const ByteArray = 7 as const
  export const String = 8 as const
  export const List = 9 as const
  export const Compound = 10 as const
  export const IntArray = 11 as const
  export const LongArray = 12 as const

  export function getName(tagType: TagType) {
    return [
      'End',
      'Byte',
      'Short',
      'Int',
      'Long',
      'Float',
      'Double',
      'ByteArray',
      'String',
      'List',
      'Compound',
      'IntArray',
      'LongArray',
    ][tagType]
  }
}

export type Schema = ListSchema | CompoundSchema | Constructor<any>
export type ListSchema = [TagType | Schema]
export type CompoundSchema = { [key: string]: TagType | Schema }

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface NBTPrototype extends CompoundSchema {
  [kNBTConstructor]: () => any
}

export interface TagCoder {
  write(buf: ByteBuffer, context: ReadContext): any
  read(buf: ByteBuffer, value: any, context: WriteContext): void
}

const coders: TagCoder[] = [
  { write: (buf) => undefined, read(buf, v) {} }, // end
  {
    write: (buf) => buf.readByte(),
    read(buf, v = 0) {
      buf.writeByte(v)
    },
  }, // byte
  {
    write: (buf) => buf.readShort(),
    read(buf, v = 0) {
      buf.writeShort(v)
    },
  }, // short
  {
    write: (buf) => buf.readInt(),
    read(buf, v = 0) {
      buf.writeInt(v)
    },
  }, // int
  {
    write: (buf) => buf.readInt64(),
    read(buf, v = 0) {
      buf.writeInt64(v)
    },
  }, // long
  {
    write: (buf) => buf.readFloat(),
    read(buf, v = 0) {
      buf.writeFloat(v)
    },
  }, // float
  {
    write: (buf) => buf.readDouble(),
    read(buf, v = 0) {
      buf.writeDouble(v)
    },
  }, // double
  {
    // byte array
    write(buf) {
      const arr = new Array(buf.readInt())
      for (let i = 0; i < arr.length; i++) {
        arr[i] = buf.readByte()
      }
      return arr
    },
    read(buf, arr = []) {
      buf.writeInt(arr.length)
      for (let i = 0; i < arr.length; i++) {
        buf.writeByte(arr[i])
      }
    },
  },
  {
    write: (buf, context) => readUTF8(buf, context),
    read: (buf, v = '', context) => writeUTF8(buf, v, context),
  }, // string
  {
    // list
    write(buf, context) {
      const listType = buf.readByte()

      assertTag(listType)

      const len = buf.readInt()
      const list = new Array(len)

      if (context.schema) {
        assertListSchema(context.schema)
      }

      if (!!context.schema && typeof context.schema === 'number' && listType !== context.schema) {
        // ignore the value if we know the type mismatched
        return list
      }

      const childContext = context.fork(context.schema ? context.schema[0] : listType)
      const shouldInspectChildType = !childContext.schema

      for (let i = 0; i < len; i++) {
        // console.log(`[read] ${shouldInspectChildType ? 'inspecting' : ''} -> [${i}]: ${JSON.stringify(nextContext.valueType)} ${TagType.getName(listType)}`);
        list[i] = coders[listType].write(buf, childContext)
        // console.log(`[read] ${shouldInspectChildType ? 'inspecting' : ''} <- [${i}]: ${JSON.stringify(nextContext.valueType)} ${TagType.getName(listType)} ${JSON.stringify(list[i])}`);
      }

      if (shouldInspectChildType) {
        context.inspect = childContext.inspect || [childContext.tagType]
      }

      return list
    },
    read(buf, value: any[] = [], context) {
      assertListSchema(context.schema)

      const valueType = context.schema[0]
      const childContext = context.fork(valueType)
      const tagType = childContext.tagType
      const writer = coders[tagType]

      assertTag(tagType)

      if ((tagType === TagType.Compound || tagType === TagType.List) && !childContext.schema) {
        // skip for undefined property
        return
      }

      try {
        buf.writeByte(tagType)
        buf.writeInt(value.length)
        for (const v of value) {
          writer.read(buf, v, childContext)
        }
      } catch (e) {
        if (e instanceof TypeError) {
          throw new TypeError(`Require ${TagType.getName(tagType)} but found ${typeof value}`)
        }
      }
    },
  },
  {
    // tag compound
    write(buf, context) {
      assertCompoundSchema(context.schema)

      const object = constructObject(context.schema) // create from constructor
      const nbtPrototype = ensurePrototype(object as any)
      const knowingType = !!context.schema

      for (let tag = 0; (tag = buf.readByte()) !== TagType.End; ) {
        const reader = coders[tag]

        const key = readUTF8(buf, context)
        // not reader or illegal tag type
        assertTag(tag)

        let childContext: ReadContext
        if (knowingType) {
          const valueType = nbtPrototype[key]
          // skip for undefined field or type not matched!
          if (
            typeof valueType === 'undefined' ||
            (typeof valueType === 'number' && valueType !== tag)
          ) {
            continue
          }
          childContext = context.fork(valueType)
        } else {
          childContext = context.fork(tag)
        }

        const shouldInspectChildType = !childContext.schema
        object[key] = reader.write(buf, childContext)
        if (shouldInspectChildType) {
          nbtPrototype[key] = childContext.inspect || childContext.tagType
        }
      }
      if (!knowingType) {
        context.inspect = nbtPrototype
      }

      return object
    },
    read(buf, object = {}, context) {
      assertCompoundSchema(context.schema)

      const schema =
        (context.schema
          ? context.schema instanceof Function
            ? getPrototypeOf(context.schema)
            : context.schema
          : getPrototypeOf(object)) || ({} as CompoundSchema)

      for (const [key, value] of Object.entries(object)) {
        const valueType = schema[key]

        if (typeof valueType === 'undefined') {
          // skip for undefined property
          continue
        }

        const childContext = context.fork(valueType)
        const tagType = childContext.tagType
        const writer = coders[tagType]

        assertTag(tagType)

        if (!childContext.schema && (tagType === TagType.Compound || tagType === TagType.List)) {
          // skip for undefined property
          continue
        }
        // console.log(`Write ${key}: ${TagType.getName(tagType)} ${JSON.stringify(childContext.schema)} ${childContext.schema} ${childContext.schema instanceof Array}`)
        try {
          buf.writeByte(tagType)
          writeUTF8(buf, key, context)
          writer.read(buf, value, childContext)
        } catch (e) {
          if (e instanceof TypeError) {
            throw new TypeError(`Required ${TagType.getName(tagType)} but found ${typeof value}`)
          }
        }
      }
      buf.writeByte(TagType.End)
    },
  },
  {
    // int array
    write(buf) {
      const arr = new Array(buf.readInt())
      for (let i = 0; i < arr.length; i++) {
        arr[i] = buf.readInt()
      }
      return arr
    },
    read(buf, v = []) {
      buf.writeInt(v.length)
      for (let i = 0; i < v.length; i++) {
        buf.writeInt(v[i])
      }
    },
  },
  {
    // long array
    write(buf) {
      const len = buf.readInt()
      const arr: bigint[] = new Array(len)
      for (let i = 0; i < len; i++) {
        arr[i] = buf.readInt64()
      }
      return arr
    },
    read(buf, v = []) {
      buf.writeInt(v.length)
      for (let i = 0; i < v.length; i++) {
        buf.writeInt64(v[i])
      }
    },
  },
]

export interface SerializationOption {
  compressed?: true | 'deflate' | 'gzip'
  /**
   * IO override for serialization
   */
  io?: { [tagType: number]: TagCoder }

  /**
   * Used for serialize function. Assign the filename for it.
   */
  filename?: string
}

export interface DeserializationOption<T> {
  compressed?: true | 'deflate' | 'gzip'
  /**
   * IO override for serialization
   */
  io?: { [tagType: number]: TagCoder }

  type?: Constructor<T>
}

/**
 * Serialzie an nbt typed json object into NBT binary
 * @param object The json
 * @param compressed Should we compress it
 */
export async function serialize(
  object: object,
  option: SerializationOption = {},
): Promise<Uint8Array> {
  const buff = writeRootTag(
    object,
    undefined,
    option.filename || '',
    Object.assign({}, coders, option.io),
  )
  return normalizeBuffer(buff, option.compressed)
}

/**
 * Deserialize the nbt binary into json
 * @param fileData The nbt binary
 */
export async function deserialize<T>(
  fileData: Uint8Array,
  option: DeserializationOption<T> = {},
): Promise<T> {
  const doUnzip = normalizeCompress(fileData, option.compressed)
  const bb = ByteBuffer.wrap(
    doUnzip === 'none'
      ? fileData
      : doUnzip === 'gzip'
        ? await ungzip(fileData)
        : await inflate(fileData),
  )

  return readRootTag(bb, Object.assign({}, coders, option.io), option.type)
}

/**
 * Serialzie an nbt typed json object into NBT binary
 * @param object The json
 */
export function serializeSync(object: object, option: SerializationOption = {}): Uint8Array {
  const buff = writeRootTag(
    object,
    undefined,
    option.filename || '',
    Object.assign({}, coders, option.io),
  )
  return normalizeBufferSync(buff, option.compressed)
}

/**
 * Deserialize the nbt binary into json
 * @param fileData The nbt binary
 * @param compressed Should we compress it
 */
export function deserializeSync<T>(fileData: Uint8Array, option: DeserializationOption<T> = {}): T {
  const doUnzip = normalizeCompress(fileData, option.compressed)
  const bb = ByteBuffer.wrap(
    doUnzip === 'none'
      ? fileData
      : doUnzip === 'gzip'
        ? gunzipSync(fileData)
        : inflateSync(fileData),
  )

  return readRootTag(bb, Object.assign({}, coders, option.io), option.type)
}

function normalizeCompress(
  fileData: Uint8Array,
  compressed?: true | 'deflate' | 'gzip',
): 'none' | 'gzip' | 'deflate' {
  let doUnzip: 'none' | 'gzip' | 'deflate'
  if (typeof compressed === 'undefined') {
    doUnzip = 'none'
  } else if (typeof compressed === 'boolean' && compressed) {
    doUnzip = 'gzip'
  } else {
    doUnzip = compressed
  }
  return doUnzip
}

function normalizeBuffer(buff: Uint8Array, compressed?: true | 'deflate' | 'gzip') {
  if (!compressed) {
    return buff
  }
  if (compressed === 'deflate') {
    return deflate(buff)
  }
  return gzip(buff)
}
function normalizeBufferSync(buff: Uint8Array, compressed?: true | 'deflate' | 'gzip') {
  if (!compressed) {
    return buff
  }
  if (compressed === 'deflate') {
    return deflateSync(buff)
  }
  return gzipSync(buff)
}

function readRootTag(buffer: ByteBuffer, io: ArrayLike<TagCoder>, type?: Constructor<any>) {
  const rootType = buffer.readByte()
  if (rootType === TagType.End) {
    throw new Error('NBTEnd')
  }
  if (rootType !== TagType.Compound) {
    throw new Error('Root tag must be a named compound tag. ' + rootType)
  }
  const context = new ReadContext(type, TagType.Compound)
  const name = readUTF8(buffer, context) // I think this is the nameProperty of the file...
  const value = io[TagType.Compound].write(buffer, context)
  return value
}

function writeRootTag(
  value: any,
  type: Schema | undefined,
  filename: string,
  coders: TagCoder[],
): Uint8Array {
  const buffer = new ByteBuffer()
  buffer.writeByte(TagType.Compound)
  const context = new WriteContext(type, 10)

  writeUTF8(buffer, filename || '', context)
  coders[TagType.Compound].read(buffer, value, context)

  return new Uint8Array(buffer.flip().buffer.slice(0, buffer.limit))
}

function assertListSchema<T>(v: T | T[]): asserts v is T[] {
  if (!(v instanceof Array)) {
    throw new Error('IllegalState')
  }
}
function assertCompoundSchema(v: Schema | undefined): asserts v is CompoundSchema | undefined {
  if (v instanceof Array) {
    throw new Error('IllegalState')
  }
}
function assertTag(v: number): asserts v is TagType {
  if (!isTagType(v)) {
    throw new Error('Unknown type ' + v)
  }
}

export class ReadContext {
  public inspect: Schema | undefined
  #decoder: TextDecoder | undefined
  constructor(
    public schema: Schema | undefined,
    public tagType: TagType,
  ) {}

  get decoder() {
    if (!this.#decoder) {
      this.#decoder = new TextDecoder()
    }
    return this.#decoder
  }

  fork(schemaOrTagType: TagType | Schema) {
    if (typeof schemaOrTagType === 'number') {
      return new ReadContext(undefined, schemaOrTagType)
    }
    return new ReadContext(
      schemaOrTagType,
      typeof schemaOrTagType === 'number'
        ? schemaOrTagType
        : schemaOrTagType instanceof Array
          ? TagType.List
          : TagType.Compound,
    )
  }
}

export class WriteContext {
  #encoder: TextEncoder | undefined
  constructor(
    readonly schema: Schema | undefined,
    readonly tagType: TagType,
  ) {}

  get encoder() {
    if (!this.#encoder) {
      this.#encoder = new TextEncoder()
    }
    return this.#encoder
  }

  fork(schemaOrTagType: TagType | Schema): WriteContext {
    if (schemaOrTagType === TagType.Compound) {
      throw new Error('IllegalState')
    }
    return new WriteContext(
      typeof schemaOrTagType === 'number' ? undefined : schemaOrTagType,
      typeof schemaOrTagType === 'number'
        ? schemaOrTagType
        : schemaOrTagType instanceof Array
          ? TagType.List
          : TagType.Compound,
    )
  }
}
