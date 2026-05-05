import { ByteBuffer } from '.'

declare module './index' {
  interface ByteBuffer {
    writeVarint32(value: number, offset?: number): ByteBuffer | number
    readVarint32(): number
    readVarint32(offset?: number): number | { value: number; length: number }
    writeVarint32ZigZag(value: number, offset?: number): ByteBuffer | number
    readVarint32ZigZag(): number
    readVarint32ZigZag(offset: number): { value: number; length: number }
    readVarint32ZigZag(offset?: number): number | { value: number; length: number }
  }
}

/**
 * Maximum number of bytes required to store a 32bit base 128 variable-length integer.
 * @type {number}
 * @const
 * @expose
 */
export const MAX_VARINT32_BYTES = 5

/**
 * Calculates the actual number of bytes required to store a 32bit base 128 variable-length integer.
 * @param {number} value Value to encode
 * @returns {number} Number of bytes required. Capped to {@link ByteBuffer.MAX_VARINT32_BYTES}
 * @expose
 */
export const calculateVarint32 = function (value: number): number {
  // ref: src/google/protobuf/io/coded_stream.cc
  value = value >>> 0
  if (value < 1 << 7) {
    return 1
  } else if (value < 1 << 14) {
    return 2
  } else if (value < 1 << 21) {
    return 3
  } else if (value < 1 << 28) {
    return 4
  } else {
    return 5
  }
}

/**
 * Zigzag encodes a signed 32bit integer so that it can be effectively used with varint encoding.
 * @param {number} n Signed 32bit integer
 * @returns {number} Unsigned zigzag encoded 32bit integer
 * @expose
 */
export const zigZagEncode32 = function (n: number): number {
  return (((n |= 0) << 1) ^ (n >> 31)) >>> 0 // ref: src/google/protobuf/wire_format_lite.h
}

/**
 * Decodes a zigzag encoded signed 32bit integer.
 * @param {number} n Unsigned zigzag encoded 32bit integer
 * @returns {number} Signed 32bit integer
 * @expose
 */
export const zigZagDecode32 = function (n: number): number {
  return ((n >>> 1) ^ -(n & 1)) | 0 // // ref: src/google/protobuf/wire_format_lite.h
}

/**
 * Writes a 32bit base 128 variable-length integer.
 * @param {number} value Value to write
 * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
 *  written if omitted.
 * @returns {!ByteBuffer|number} this if `offset` is omitted, else the actual number of bytes written
 * @expose
 */
ByteBuffer.prototype.writeVarint32 = function (
  value: number,
  offset?: number,
): ByteBuffer | number {
  const relative = typeof offset === 'undefined'
  if (relative) {
    offset = this.offset
  }
  if (!this.noAssert) {
    if (typeof value !== 'number' || value % 1 !== 0) {
      throw TypeError('Illegal value: ' + value + ' (not an integer)')
    }
    value |= 0
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
  const size = calculateVarint32(value)
  let b
  offset! += size
  let capacity10 = this.buffer.byteLength
  if (offset! > capacity10) {
    this.resize((capacity10 *= 2) > offset! ? capacity10 : offset!)
  }
  offset! -= size
  value >>>= 0
  while (value >= 0x80) {
    b = (value & 0x7f) | 0x80
    this.view.setUint8(offset!++, b)
    value >>>= 7
  }
  this.view.setUint8(offset!++, value)
  if (relative) {
    this.offset = offset!
    return this
  }
  return size
}

/**
 * Writes a zig-zag encoded (signed) 32bit base 128 variable-length integer.
 * @param {number} value Value to write
 * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
 *  written if omitted.
 * @returns {!ByteBuffer|number} this if `offset` is omitted, else the actual number of bytes written
 * @expose
 */
ByteBuffer.prototype.writeVarint32ZigZag = function (
  value: number,
  offset?: number,
): ByteBuffer | number {
  return this.writeVarint32(zigZagEncode32(value), offset)
}

/**
 * Reads a 32bit base 128 variable-length integer.
 * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
 *  written if omitted.
 * @returns {number|!{value: number, length: number}} The value read if offset is omitted, else the value read
 *  and the actual number of bytes read.
 * @throws {Error} If it's not a valid varint. Has a property `truncated = true` if there is not enough data available
 *  to fully decode the varint.
 * @expose
 */
// @ts-ignore
ByteBuffer.prototype.readVarint32 = function (
  offset?: number,
): number | { value: number; length: number } {
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
  let c = 0
  let value = 0 >>> 0
  let b
  do {
    if (!this.noAssert && offset! > this.limit) {
      const err = Error('Truncated')
      // @ts-ignore
      err.truncated = true
      throw err
    }
    b = this.view.getUint8(offset!++)
    if (c < 5) {
      value |= (b & 0x7f) << (7 * c)
    }
    ++c
  } while ((b & 0x80) !== 0)
  value |= 0
  if (relative) {
    this.offset = offset!
    return value
  }
  return {
    value,
    length: c,
  }
}

/**
 * Reads a zig-zag encoded (signed) 32bit base 128 variable-length integer.
 * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
 *  written if omitted.
 * @returns {number|!{value: number, length: number}} The value read if offset is omitted, else the value read
 *  and the actual number of bytes read.
 * @throws {Error} If it's not a valid varint
 * @expose
 */
// @ts-ignore
ByteBuffer.prototype.readVarint32ZigZag = function (
  offset?: number,
): number | { value: number; length: number } {
  let val = this.readVarint32(offset)
  if (typeof val === 'object') {
    val.value = zigZagDecode32(val.value)
  } else {
    val = zigZagDecode32(val)
  }
  return val
}
