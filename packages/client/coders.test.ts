// eslint-disable-next-line @typescript-eslint/no-redeclare
import {
  VarInt,
  VarLong,
  Long,
  Short,
  Float,
  String,
  Bool,
  Byte,
  UByte,
  Int,
  ByteArray,
  Double,
  Json,
  Slot,
  UUID,
  UShort,
} from './coders'
import { ByteBuffer } from '@xmcl/bytebuffer'
import { randomUUID } from 'crypto'
import { describe, test, expect } from 'vitest'

describe('Coders', () => {
  test('UByte', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 124
    UByte.encode(bb, input)
    bb.flip()
    const output = UByte.decode(bb)
    expect(output).toEqual(input)
  })
  test('Json', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = { key: 124, b: 'x' }
    Json.encode(bb, input)
    bb.flip()
    const output = Json.decode(bb)
    expect(output).toEqual(input)
  })
  test('Slot', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = { blockId: 1 }
    Slot.encode(bb, input)
    bb.flip()
    const output = Slot.decode(bb)
    expect(output).toEqual(input)
  })
  test('UUID', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = randomUUID()
    UUID.encode(bb, input)
    bb.flip()
    const output = UUID.decode(bb)
    expect(output).toEqual(input)
  })
  test('Int', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024
    Int.encode(bb, input)
    bb.flip()
    const output = Int.decode(bb)
    expect(output).toEqual(input)
  })
  test('VarInt', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024
    VarInt.encode(bb, input)
    bb.flip()
    const output = VarInt.decode(bb)
    expect(output).toEqual(input)
  })
  test('Short', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024
    Short.encode(bb, input)
    bb.flip()
    const output = Short.decode(bb)
    expect(output).toEqual(input)
  })
  test('UShort', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024
    UShort.encode(bb, input)
    bb.flip()
    const output = UShort.decode(bb)
    expect(output).toEqual(input)
  })
  test('Float', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024
    Float.encode(bb, input)
    bb.flip()
    const output = Float.decode(bb)
    expect(output).toEqual(input)
  })
  test('Double', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024
    Double.encode(bb, input)
    bb.flip()
    const output = Double.decode(bb)
    expect(output).toEqual(input)
  })
  test('String', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = '1024'
    String.encode(bb, input)
    bb.flip()
    const output = String.decode(bb)
    expect(output).toEqual(input)
  })
  test('Bool', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = false
    Bool.encode(bb, input)
    bb.flip()
    const output = Bool.decode(bb)
    expect(output).toEqual(input)
  })
  test('ByteArray', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = new Int8Array(10).fill(1)
    ByteArray.encode(bb, input)
    bb.flip()
    const output = ByteArray.decode(bb)
    expect(output).toEqual(input)
  })
  test('Byte', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 12
    Byte.encode(bb, input)
    bb.flip()
    const output = Byte.decode(bb)
    expect(output).toEqual(input)
  })
  test('VarLong', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024n
    VarLong.encode(bb, input)
    bb.flip()
    const output = VarLong.decode(bb)
    expect(output).toEqual(input)
  })
  test('Long', () => {
    const bb = ByteBuffer.allocate(1024)
    const input = 1024n
    Long.encode(bb, input)
    bb.flip()
    const output = Long.decode(bb)
    expect(output).toEqual(input)
  })
})
