/* eslint-disable no-fallthrough */
import { ByteBuffer } from '.'

declare module './index' {
  interface ByteBuffer {
    /**
     * Writes a 64bit base 128 variable-length integer.
     * @param {number|bigint} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} `this` if offset is omitted, else the actual number of bytes written.
     * @expose
     */
    writeVarint64(value: number | bigint, offset?: number): ByteBuffer | number
    readVarint64(): bigint
    readVarint64(offset: number): { value: bigint; length: number }
    /**
     * Reads a 64bit base 128 variable-length integer. Requires bigint.js.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {!bigint|!{value: bigint, length: number}} The value read if offset is omitted, else the value read and
     *  the actual number of bytes read.
     * @throws {Error} If it's not a valid varint
     * @expose
     */
    readVarint64(offset?: number): bigint | { value: bigint; length: number }
    /**
     * Writes a zig-zag encoded 64bit base 128 variable-length integer.
     * @param {number|bigint} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} `this` if offset is omitted, else the actual number of bytes written.
     * @expose
     */
    writeVarint64ZigZag(value: number | bigint, offset?: number): ByteBuffer | number
    readVarint64ZigZag(offset?: number): bigint | { value: number | bigint; length: number }
  }
}

/**
 * Maximum number of bytes required to store a 64bit base 128 variable-length integer.
 * @type {number}
 * @const
 * @expose
 */
export const MAX_VARINT64_BYTES = 10

/**
 * Calculates the actual number of bytes required to store a 64bit base 128 variable-length integer.
 * @param {number|!bigint} value Value to encode
 * @returns {number} Number of bytes required. Capped to {@link ByteBuffer.MAX_VARINT64_BYTES}
 * @expose
 */
export const calculateVarint64 = function (value: number | bigint): number {
  if (typeof value === 'number') {
    value = BigInt(value)
  }
  // ref: src/google/protobuf/io/coded_stream.cc
  const part0 = Number(value) >>> 0
  const part1 = Number(value >> 28n) >>> 0
  const part2 = Number(value >> 56n) >>> 0
  if (part2 === 0) {
    if (part1 === 0) {
      if (part0 < 1 << 14) {
        return part0 < 1 << 7 ? 1 : 2
      } else {
        return part0 < 1 << 21 ? 3 : 4
      }
    } else {
      if (part1 < 1 << 14) {
        return part1 < 1 << 7 ? 5 : 6
      } else {
        return part1 < 1 << 21 ? 7 : 8
      }
    }
  } else {
    return part2 < 1 << 7 ? 9 : 10
  }
}

/**
 * Zigzag encodes a signed 64bit integer so that it can be effectively used with varint encoding.
 * @param {number|!bigint} value Signed long
 * @returns {!bigint} Unsigned zigzag encoded long
 * @expose
 */
export const zigZagEncode64 = function (value: number | bigint): bigint {
  if (typeof value === 'number') {
    value = BigInt(value)
  }
  // ref: src/google/protobuf/wire_format_lite.h
  return (value << 1n) ^ (value >> 63n)
}

/**
 * Decodes a zigzag encoded signed 64bit integer.
 * @param {!bigint|number} value Unsigned zigzag encoded long or JavaScript number
 * @returns {!bigint} Signed long
 * @expose
 */
export const zigZagDecode64 = function (value: bigint | number): bigint {
  if (typeof value === 'number') {
    value = BigInt(value)
  }
  // ref: src/google/protobuf/wire_format_lite.h
  return (value >> 1n) ^ (~(value & 1n) + 1n)
}

ByteBuffer.prototype.writeVarint64 = function (
  value: number | bigint,
  offset?: number,
): ByteBuffer | number {
  const relative = typeof offset === 'undefined'
  if (relative) {
    offset = this.offset
  }
  if (!this.noAssert) {
    if (typeof value === 'number') {
      value = BigInt(value)
    }
    if (typeof offset !== 'number' || offset % 1 !== 0) {
      throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
    }
    offset >>>= 0
    if (offset < 0 || offset + 0 > this.buffer.byteLength) {
      throw RangeError(
        'Illegal offset: 0 <= ' + offset + ' (+' + 0 + ') <= ' + this.buffer.byteLength,
      )
    }
  }
  if (typeof value === 'number') {
    value = BigInt(value)
  }
  const size = calculateVarint64(value)
  const part0 = Number(value) >>> 0
  const part1 = Number(value >> 28n) >>> 0
  const part2 = Number(value >> 56n) >>> 0
  offset! += size
  let capacity11 = this.buffer.byteLength
  if (offset! > capacity11) {
    this.resize((capacity11 *= 2) > offset! ? capacity11 : offset!)
  }
  offset! -= size
  switch (size) {
    case 10:
      this.view.setUint8(offset! + 9, (part2 >>> 7) & 0x01)
    case 9:
      this.view.setUint8(offset! + 8, size !== 9 ? part2 | 0x80 : part2 & 0x7f)
    case 8:
      this.view.setUint8(offset! + 7, size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7f)
    case 7:
      this.view.setUint8(offset! + 6, size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7f)
    case 6:
      this.view.setUint8(offset! + 5, size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7f)
    case 5:
      this.view.setUint8(offset! + 4, size !== 5 ? part1 | 0x80 : part1 & 0x7f)
    case 4:
      this.view.setUint8(offset! + 3, size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7f)
    case 3:
      this.view.setUint8(offset! + 2, size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7f)
    case 2:
      this.view.setUint8(offset! + 1, size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7f)
    case 1:
      this.view.setUint8(offset!, size !== 1 ? part0 | 0x80 : part0 & 0x7f)
  }
  if (relative) {
    this.offset += size
    return this
  } else {
    return size
  }
}

ByteBuffer.prototype.writeVarint64ZigZag = function (
  value: number | bigint,
  offset?: number,
): ByteBuffer | number {
  return this.writeVarint64(zigZagEncode64(value), offset)
}

// @ts-ignore
ByteBuffer.prototype.readVarint64 = function (
  offset?: number,
): bigint | { value: bigint; length: number } {
  const relative = typeof offset === 'undefined'
  if (relative) {
    offset = this.offset
  }
  if (!this.noAssert) {
    if (typeof offset !== 'number' || offset % 1 !== 0) {
      throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
    }
    offset >>>= 0
    if (offset < 0 || offset + 1 > this.buffer.byteLength) {
      throw RangeError(
        'Illegal offset: 0 <= ' + offset + ' (+' + 1 + ') <= ' + this.buffer.byteLength,
      )
    }
  }
  // ref: src/google/protobuf/io/coded_stream.cc
  const start = offset
  let part0 = 0
  let part1 = 0
  let part2 = 0
  let b = 0
  b = this.view.getUint8(offset!++)
  part0 = b & 0x7f
  if (b & 0x80) {
    b = this.view.getUint8(offset!++)
    part0 |= (b & 0x7f) << 7
    if (b & 0x80) {
      b = this.view.getUint8(offset!++)
      part0 |= (b & 0x7f) << 14
      if (b & 0x80) {
        b = this.view.getUint8(offset!++)
        part0 |= (b & 0x7f) << 21
        if (b & 0x80) {
          b = this.view.getUint8(offset!++)
          part1 = b & 0x7f
          if (b & 0x80) {
            b = this.view.getUint8(offset!++)
            part1 |= (b & 0x7f) << 7
            if (b & 0x80) {
              b = this.view.getUint8(offset!++)
              part1 |= (b & 0x7f) << 14
              if (b & 0x80) {
                b = this.view.getUint8(offset!++)
                part1 |= (b & 0x7f) << 21
                if (b & 0x80) {
                  b = this.view.getUint8(offset!++)
                  part2 = b & 0x7f
                  if (b & 0x80) {
                    b = this.view.getUint8(offset!++)
                    part2 |= (b & 0x7f) << 7
                    if (b & 0x80) {
                      throw Error('Buffer overrun')
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  const value = BigInt(part0 | (part1 << 28)) | (BigInt((part1 >>> 4) | (part2 << 24)) << 32n)
  if (relative) {
    this.offset = offset!
    return value
  } else {
    return {
      value,
      length: offset! - start!,
    }
  }
}

/**
 * Reads a zig-zag encoded 64bit base 128 variable-length integer. Requires bigint.js.
 * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
 *  read if omitted.
 * @returns {!bigint|!{value: bigint, length: number}} The value read if offset is omitted, else the value read and
 *  the actual number of bytes read.
 * @throws {Error} If it's not a valid varint
 * @expose
 */
ByteBuffer.prototype.readVarint64ZigZag = function (
  offset?: number,
): bigint | { value: bigint; length: number } {
  let val = this.readVarint64(offset)
  if (val && typeof val === 'object') {
    val.value = zigZagDecode64(val.value)
  } else {
    val = zigZagDecode64(val)
  }
  return val
}
