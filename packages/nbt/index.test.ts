import {
  TagType,
  serialize,
  deserialize,
  getPrototypeOf,
  serializeSync,
  deserializeSync,
  kNBTConstructor,
  kNBTPrototype,
} from './index'
import { describe, test, expect } from 'vitest'

class NestedType {
  @TagType(TagType.String)
  hello = 's'
}
class TestType {
  @TagType(TagType.String)
  name = 'ci010'

  @TagType(TagType.String)
  type = 'author'

  @TagType(TagType.Byte)
  byte = 10

  @TagType(TagType.Short)
  short = 10

  @TagType(TagType.Int)
  int = 10

  @TagType(TagType.LongArray)
  longArray = [8589934593n]

  @TagType(TagType.ByteArray)
  byteArray = [1, 1]

  @TagType(TagType.Long)
  long = 132n

  @TagType(TagType.Float)
  float = 0.25

  @TagType(TagType.Double)
  double = 0.00001

  @TagType(TagType.IntArray)
  intArray = [12, 3, 4, 512]

  @TagType({ name: TagType.String, type: TagType.String, value: TagType.String })
  nestedAnonymous = {
    name: 'indexyz',
    type: 'author',
    value: 'ilauncher',
  }

  @TagType(NestedType)
  nested = new NestedType()

  @TagType([NestedType])
  compoundList = [new NestedType(), new NestedType()]

  @TagType([TagType.Int])
  intList = [1, 23]
}

class AbsentType {
  @TagType(TagType.String)
  a = ''

  b = ''
}

interface ThridPartyInterface {
  hello: string
}

class MyOwnNBTSchema implements ThridPartyInterface {
  @TagType(TagType.String)
  hello = ''
}

describe('NBT', () => {
  function matchBuffer(a: Uint8Array, b: Uint8Array) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((v, i) => v === b[i])
  }
  describe('#getPrototypeOf', () => {
    test('should be able to get prototype', () => {
      expect(getPrototypeOf(new AbsentType())?.a).toEqual(TagType.String)
      expect(getPrototypeOf(AbsentType.prototype)?.a).toEqual(TagType.String)
      expect(getPrototypeOf(AbsentType)?.a).toEqual(TagType.String)
    })
    test('should be able to cache prototype', () => {
      const proto = getPrototypeOf(TestType)
      expect(proto).toBeTruthy()
      const object = proto![kNBTConstructor]()
      expect(Object.getPrototypeOf(object)).toEqual(TestType.prototype)
    })
  })

  describe('#serialize', () => {
    test('should be able to serialize the object with prototype', async () => {
      const a: ThridPartyInterface = { hello: '1' }
      Object.setPrototypeOf(a, MyOwnNBTSchema.prototype)
      const buf = await serialize(a)
      const result = await deserialize(buf)
      // console.log(result)
      expect(result).toEqual(a)
      expect(Object.getPrototypeOf(result)).toEqual({})
    })
    test('should be able to serialize the object from prototype', async () => {
      const object = new MyOwnNBTSchema()
      const buf = await serialize(object)
      const result = await deserialize(buf)
      expect(result).toEqual(object)
      expect(Object.getPrototypeOf(result)).toEqual({})
    })
    test('should be able to deserialize the object with prototype', async () => {
      const object = new MyOwnNBTSchema()
      const buf = await serialize(object)
      const result = await deserialize(buf, { type: MyOwnNBTSchema })
      expect(result).toEqual(object)
      expect(Object.getPrototypeOf(result)).toEqual(MyOwnNBTSchema.prototype)
    })
    test('should ignore the unannotated field', async () => {
      const src = new AbsentType()
      src.a = 'a'
      src.b = 'b'
      const buf = await serialize(src)
      const result: AbsentType = await deserialize(buf)
      expect(result.a).toEqual('a')
      expect(result.b).toBeUndefined()
    })
    test('should use default to write the fields if empty', async () => {
      const src = new TestType()
      for (const key of Object.keys(src)) {
        ;(src as any)[key] = undefined
      }
      const buf = await serialize(src)
      const result: TestType = await deserialize(buf, { type: TestType })
      expect(result.byte).toEqual(0)
      expect(result.int).toEqual(0)
      expect(result.short).toEqual(0)
      expect(result.float).toEqual(0)
      expect(result.name).toEqual('')
      expect(result.nestedAnonymous).toEqual({})
      expect(result.compoundList).toEqual([])
      expect(result.intList).toEqual([])
    })

    function testNBT(compress: 'gzip' | 'deflate' | undefined | true) {
      test('sync', () => {
        const src = new TestType()
        const buffer = serializeSync(src, { compressed: compress })
        expect(buffer).toBeTruthy()
        const value = deserializeSync(buffer, { compressed: compress, type: TestType })
        expect(value).toStrictEqual(src)
      })
      test('async', async () => {
        const src = new TestType()
        const buffer = await serialize(src, { compressed: compress })
        expect(buffer).toBeTruthy()
        const value = await deserialize(buffer, { compressed: compress, type: TestType })
        expect(value).toStrictEqual(src)
      })
    }

    describe('non-compressed', () => {
      testNBT(undefined)
    })
    describe('deflate', () => {
      testNBT('deflate')
    })
    describe('gzip', () => {
      testNBT('gzip')
    })
    describe('default', () => {
      testNBT(true)
    })
  })
})
