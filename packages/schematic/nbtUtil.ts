import { setPrototypeOf, TagType } from '@xmcl/nbt'
import type { Schema } from '@xmcl/nbt'

/**
 * Detect whether the given buffer is gzip-compressed (NBT files usually are).
 */
export function isGzip(data: Uint8Array) {
  return data.length > 2 && data[0] === 0x1f && data[1] === 0x8b
}

/**
 * Attach an NBT type schema to a plain object so it can be serialized by
 * `@xmcl/nbt`. Fields not present in the schema are skipped on write, so every
 * field that should be persisted must be described.
 */
export function withSchema<T extends object>(object: T, schema: Schema): T {
  setPrototypeOf(object, schema as any)
  return object
}

/**
 * Decode a Sponge schematic VarInt block-data stream (LEB128) into palette
 * indices.
 */
export function readVarInts(bytes: ArrayLike<number>): number[] {
  const out: number[] = []
  let i = 0
  while (i < bytes.length) {
    let value = 0
    let shift = 0
    let b: number
    do {
      b = bytes[i++] & 0xff
      value |= (b & 0x7f) << shift
      shift += 7
      if (shift > 35) throw new Error('VarInt is too big')
    } while ((b & 0x80) !== 0)
    out.push(value >>> 0)
  }
  return out
}

/**
 * Encode palette indices into a Sponge schematic VarInt block-data stream.
 */
export function writeVarInts(values: ArrayLike<number>): number[] {
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    let v = values[i] >>> 0
    while ((v & ~0x7f) !== 0) {
      out.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    out.push(v)
  }
  return out
}

const MASK64 = (1n << 64n) - 1n

function asUnsigned(v: bigint) {
  return v & MASK64
}

function asSigned(v: bigint) {
  v &= MASK64
  return v >= 1n << 63n ? v - (1n << 64n) : v
}

/**
 * Decode a Litematica `BlockStates` long-array into palette indices.
 *
 * Litematica packs `bits` per entry, least-significant-bit first, allowing an
 * entry to straddle two longs.
 */
export function unpackLitematicaStates(longs: bigint[], count: number, paletteSize: number): Uint16Array {
  const bits = Math.max(2, 32 - Math.clz32(paletteSize - 1))
  const bitsBig = BigInt(bits)
  const mask = (1n << bitsBig) - 1n
  const result = new Uint16Array(count)
  for (let i = 0; i < count; i++) {
    const startOffset = i * bits
    const startArrIndex = startOffset >> 6
    const endArrIndex = ((i + 1) * bits - 1) >> 6
    const startBitOffset = BigInt(startOffset & 0x3f)
    let value: bigint
    if (startArrIndex === endArrIndex) {
      value = (asUnsigned(longs[startArrIndex]) >> startBitOffset) & mask
    } else {
      const endOffset = 64n - startBitOffset
      value = ((asUnsigned(longs[startArrIndex]) >> startBitOffset) | (asUnsigned(longs[endArrIndex]) << endOffset)) & mask
    }
    result[i] = Number(value)
  }
  return result
}

/**
 * Encode palette indices into a Litematica `BlockStates` long-array.
 */
export function packLitematicaStates(indices: ArrayLike<number>, paletteSize: number): bigint[] {
  const bits = Math.max(2, 32 - Math.clz32(paletteSize - 1))
  const count = indices.length
  const totalBits = count * bits
  const longCount = Math.ceil(totalBits / 64)
  const longs = new Array<bigint>(longCount).fill(0n)
  for (let i = 0; i < count; i++) {
    const value = BigInt(indices[i] >>> 0)
    const startOffset = i * bits
    const startArrIndex = startOffset >> 6
    const endArrIndex = ((i + 1) * bits - 1) >> 6
    const startBitOffset = BigInt(startOffset & 0x3f)
    longs[startArrIndex] = asUnsigned(longs[startArrIndex] | (value << startBitOffset))
    if (startArrIndex !== endArrIndex) {
      const endOffset = 64n - startBitOffset
      longs[endArrIndex] = asUnsigned(longs[endArrIndex] | (value >> endOffset))
    }
  }
  return longs.map((l) => asSigned(l))
}

export { TagType }
