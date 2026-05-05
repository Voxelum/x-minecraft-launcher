/*
 Copyright 2013-2014 Daniel Wirtz <dcode@dcode.io>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * @license bytebuffer.js (c) 2015 Daniel Wirtz <dcode@dcode.io>
 * Backing buffer: ArrayBuffer, Accessor: DataView
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/bytebuffer.js for details
 * @module @xmcl/bytebuffer
 */

export class ByteBuffer {
  /**
   * ByteBuffer version.
   * @type {string}
   * @const
   * @expose
   */
  static VERSION = '0.0.1'

  /**
   * Little endian constant that can be used instead of its boolean value. Evaluates to `true`.
   * @type {boolean}
   * @const
   * @expose
   */
  static LITTLE_ENDIAN = true

  /**
   * Big endian constant that can be used instead of its boolean value. Evaluates to `false`.
   * @type {boolean}
   * @const
   * @expose
   */
  static BIG_ENDIAN = false

  /**
   * Default initial capacity of `16`.
   * @type {number}
   * @expose
   */
  static DEFAULT_CAPACITY = 16

  /**
   * Default endianess of `false` for big endian.
   * @type {boolean}
   * @expose
   */
  static DEFAULT_ENDIAN: boolean = ByteBuffer.BIG_ENDIAN

  /**
   * Default no assertions flag of `false`.
   * @type {boolean}
   * @expose
   */
  static DEFAULT_NOASSERT = false
  /**
   * Backing ArrayBuffer.
   * @type {!ArrayBuffer}
   * @expose
   */
  buffer: ArrayBuffer
  /**
   * DataView utilized to manipulate the backing buffer. Becomes `null` if the backing buffer has a capacity of `0`.
   * @type {?DataView}
   * @expose
   */
  view: DataView
  /**
   * Absolute read/write offset.
   * @type {number}
   * @expose
   * @see ByteBuffer#flip
   * @see ByteBuffer#clear
   */
  offset: number
  /**
   * Marked offset.
   * @type {number}
   * @expose
   * @see ByteBuffer#mark
   * @see ByteBuffer#reset
   */
  markedOffset: number
  /**
   * Absolute limit of the contained data. Set to the backing buffer's capacity upon allocation.
   * @type {number}
   * @expose
   * @see ByteBuffer#flip
   * @see ByteBuffer#clear
   */
  limit: number
  /**
   * Whether to use little endian byte order, defaults to `false` for big endian.
   * @type {boolean}
   * @expose
   */
  littleEndian: boolean
  /**
   * Whether to skip assertions of offsets and values, defaults to `false`.
   * @type {boolean}
   * @expose
   */
  noAssert: boolean
  /**
   * Constructs a new ByteBuffer.
   * @class The swiss army knife for binary data in JavaScript.
   * @exports ByteBuffer
   * @constructor
   * @param {number=} capacity Initial capacity. Defaults to {@link ByteBuffer.DEFAULT_CAPACITY}.
   * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
   *  {@link ByteBuffer.DEFAULT_ENDIAN}.
   * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
   *  {@link ByteBuffer.DEFAULT_NOASSERT}.
   * @expose
   */
  constructor(capacity?: number, littleEndian?: boolean, noAssert?: boolean) {
    if (typeof capacity === 'undefined') {
      capacity = ByteBuffer.DEFAULT_CAPACITY
    }
    if (typeof littleEndian === 'undefined') {
      littleEndian = ByteBuffer.DEFAULT_ENDIAN
    }
    if (typeof noAssert === 'undefined') {
      noAssert = ByteBuffer.DEFAULT_NOASSERT
    }
    if (!noAssert) {
      capacity = capacity | 0
      if (capacity < 0) {
        throw RangeError('Illegal capacity')
      }
      littleEndian = !!littleEndian
      noAssert = !!noAssert
    }

    this.buffer = capacity === 0 ? EMPTY_BUFFER : new ArrayBuffer(capacity)
    this.view = capacity === 0 ? new DataView(EMPTY_BUFFER) : new DataView(this.buffer)
    this.offset = 0
    this.markedOffset = -1
    this.limit = capacity
    this.littleEndian = littleEndian
    this.noAssert = noAssert
  }

  /**
   * Gets the accessor type.
   * @returns {Function} `Buffer` under node.js, `Uint8Array` respectively `DataView` in the browser (classes)
   * @expose
   */
  static accessor = function () {
    return DataView
  }

  /**
   * Allocates a new ByteBuffer backed by a buffer of the specified capacity.
   * @param {number=} capacity Initial capacity. Defaults to {@link ByteBuffer.DEFAULT_CAPACITY}.
   * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
   *  {@link ByteBuffer.DEFAULT_ENDIAN}.
   * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
   *  {@link ByteBuffer.DEFAULT_NOASSERT}.
   * @returns {!ByteBuffer}
   * @expose
   */
  static allocate = function (
    capacity?: number,
    littleEndian?: boolean,
    noAssert?: boolean,
  ): ByteBuffer {
    return new ByteBuffer(capacity, littleEndian, noAssert)
  }

  /**
   * Concatenates multiple ByteBuffers into one.
   * @param {!Array.<!ByteBuffer|!ArrayBuffer|!Uint8Array>} buffers Buffers to concatenate
   * @param {(string|boolean)=} encoding String encoding if `buffers` contains a string ("base64", "hex", "binary",
   *  defaults to "utf8")
   * @param {boolean=} littleEndian Whether to use little or big endian byte order for the resulting ByteBuffer. Defaults
   *  to {@link ByteBuffer.DEFAULT_ENDIAN}.
   * @param {boolean=} noAssert Whether to skip assertions of offsets and values for the resulting ByteBuffer. Defaults to
   *  {@link ByteBuffer.DEFAULT_NOASSERT}.
   * @returns {!ByteBuffer} Concatenated ByteBuffer
   * @expose
   */
  static concat = function (
    buffers: Array<ByteBuffer | ArrayBuffer | Uint8Array>,
    littleEndian?: boolean,
    noAssert?: boolean,
  ): ByteBuffer {
    let capacity = 0
    const k = buffers.length
    let length
    for (let i = 0, length; i < k; ++i) {
      const buf = buffers[i]
      if (!(buf instanceof ByteBuffer)) {
        buffers[i] = ByteBuffer.wrap(buf)
      }
      // @ts-ignore
      length = buffers[i].limit - buffers[i].offset
      if (length > 0) {
        capacity += length
      }
    }
    if (capacity === 0) {
      return new ByteBuffer(0, littleEndian, noAssert)
    }
    const bb = new ByteBuffer(capacity, littleEndian, noAssert)
    let bi
    const view = new Uint8Array(bb.buffer)
    let i = 0
    while (i < k) {
      bi = buffers[i++]
      // @ts-ignore
      length = bi.limit - bi.offset
      if (length <= 0) {
        continue
      }
      // @ts-ignore
      view.set(new Uint8Array(bi.buffer).subarray(bi.offset, bi.limit), bb.offset)
      bb.offset += length
    }
    bb.limit = bb.offset
    bb.offset = 0
    return bb
  }

  /**
   * Gets the backing buffer type.
   * @returns {Function} `Buffer` under node.js, `ArrayBuffer` in the browser (classes)
   * @expose
   */
  static type = function () {
    return ArrayBuffer
  }

  /**
   * Wraps a buffer or a string. Sets the allocated ByteBuffer's {@link ByteBuffer#offset} to `0` and its
   *  {@link ByteBuffer#limit} to the length of the wrapped data.
   * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string|!Array.<number>} buffer Anything that can be wrapped
   * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
   *  {@link ByteBuffer.DEFAULT_ENDIAN}.
   * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
   *  {@link ByteBuffer.DEFAULT_NOASSERT}.
   * @returns {!ByteBuffer} A ByteBuffer wrapping `buffer`
   * @expose
   */
  static wrap = function (
    buffer: ArrayBuffer | number[] | Uint8Array,
    littleEndian?: boolean,
    noAssert?: boolean,
  ): ByteBuffer {
    if (buffer === null || typeof buffer !== 'object') {
      throw TypeError('Illegal buffer')
    }
    let bb
    if (buffer instanceof ByteBuffer) {
      bb = buffer.clone()
      bb.markedOffset = -1
      return bb
    }
    if (buffer instanceof Uint8Array) {
      // Extract ArrayBuffer from Uint8Array
      bb = new ByteBuffer(0, littleEndian, noAssert)
      if (buffer.length > 0) {
        // Avoid references to more than one EMPTY_BUFFER
        bb.buffer = buffer.buffer as ArrayBuffer
        bb.offset = buffer.byteOffset
        bb.limit = buffer.byteOffset + buffer.byteLength
        bb.view = new DataView(buffer.buffer)
      }
    } else if (buffer instanceof ArrayBuffer) {
      // Reuse ArrayBuffer
      bb = new ByteBuffer(0, littleEndian, noAssert)
      if (buffer.byteLength > 0) {
        bb.buffer = buffer
        bb.offset = 0
        bb.limit = buffer.byteLength
        bb.view = buffer.byteLength > 0 ? new DataView(buffer) : new DataView(EMPTY_BUFFER)
      }
    } else if (Object.prototype.toString.call(buffer) === '[object Array]') {
      // Create from octets
      bb = new ByteBuffer(buffer.length, littleEndian, noAssert)
      bb.limit = buffer.length
      for (let i = 0; i < buffer.length; ++i) {
        bb.view.setUint8(i, buffer[i])
      }
    } else {
      throw TypeError('Illegal buffer')
    } // Otherwise fail
    return bb
  }

  /**
   * Reads the specified number of bytes.
   * @param {number} length Number of bytes to read
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
   * @returns {!ByteBuffer}
   * @expose
   */
  readBytes(length: number, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + length > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + length + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const slice = this.slice(offset, offset! + length)
    if (relative) {
      this.offset += length
    }
    return slice
  }

  /**
   * Writes a payload of bytes. This is an alias of {@link ByteBuffer#append}.
   * @function
   * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string} source Data to write. If `source` is a ByteBuffer, its offsets
   *  will be modified according to the performed read operation.
   * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
   *  written if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeBytes = this.append

  // types/ints/int8

  /**
   * Writes an 8bit signed integer.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeInt8(value: number, offset?: number): ByteBuffer {
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
    offset! += 1
    let capacity0 = this.buffer.byteLength
    if (offset! > capacity0) {
      this.resize((capacity0 *= 2) > offset! ? capacity0 : offset!)
    }
    offset! -= 1
    this.view.setInt8(offset!, value)
    if (relative) {
      this.offset += 1
    }
    return this
  }

  /**
   * Writes an 8bit signed integer. This is an alias of {@link ByteBuffer#writeInt8}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeByte = this.writeInt8

  /**
   * Reads an 8bit signed integer.
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readInt8(offset?: number): number {
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
    const value = this.view.getInt8(offset!)
    if (relative) {
      this.offset += 1
    }
    return value
  }

  /**
   * Reads an 8bit signed integer. This is an alias of {@link ByteBuffer#readInt8}.
   * @function
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readByte = this.readInt8

  /**
   * Writes an 8bit unsigned integer.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeUint8(value: number, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof value !== 'number' || value % 1 !== 0) {
        throw TypeError('Illegal value: ' + value + ' (not an integer)')
      }
      value >>>= 0
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
    offset! += 1
    let capacity1 = this.buffer.byteLength
    if (offset! > capacity1) {
      this.resize((capacity1 *= 2) > offset! ? capacity1 : offset!)
    }
    offset! -= 1
    this.view.setUint8(offset!, value)
    if (relative) {
      this.offset += 1
    }
    return this
  }

  /**
   * Writes an 8bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint8}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeUInt8 = this.writeUint8

  /**
   * Reads an 8bit unsigned integer.
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readUint8(offset?: number): number {
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
    const value = this.view.getUint8(offset!)
    if (relative) {
      this.offset += 1
    }
    return value
  }

  /**
   * Reads an 8bit unsigned integer. This is an alias of {@link ByteBuffer#readUint8}.
   * @function
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readUInt8 = this.readUint8

  // types/ints/int16

  /**
   * Writes a 16bit signed integer.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @throws {TypeError} If `offset` or `value` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  writeInt16(value: number, offset?: number) {
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
    offset! += 2
    let capacity2 = this.buffer.byteLength
    if (offset! > capacity2) {
      this.resize((capacity2 *= 2) > offset! ? capacity2 : offset!)
    }
    offset! -= 2
    this.view.setInt16(offset!, value, this.littleEndian)
    if (relative) {
      this.offset += 2
    }
    return this
  }

  /**
   * Writes a 16bit signed integer. This is an alias of {@link ByteBuffer#writeInt16}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @throws {TypeError} If `offset` or `value` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  writeShort = this.writeInt16

  /**
   * Reads a 16bit signed integer.
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @returns {number} Value read
   * @throws {TypeError} If `offset` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  readInt16(offset?: number): number {
    const relative = typeof offset === 'undefined'
    if (typeof offset === 'undefined') {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 2 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 2 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getInt16(offset, this.littleEndian)
    if (relative) {
      this.offset += 2
    }
    return value
  }

  /**
   * Reads a 16bit signed integer. This is an alias of {@link ByteBuffer#readInt16}.
   * @function
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @returns {number} Value read
   * @throws {TypeError} If `offset` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  readShort = this.readInt16

  /**
   * Writes a 16bit unsigned integer.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @throws {TypeError} If `offset` or `value` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  writeUint16(value: number, offset?: number) {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof value !== 'number' || value % 1 !== 0) {
        throw TypeError('Illegal value: ' + value + ' (not an integer)')
      }
      value >>>= 0
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
    offset! += 2
    let capacity3 = this.buffer.byteLength
    if (offset! > capacity3) {
      this.resize((capacity3 *= 2) > offset! ? capacity3 : offset!)
    }
    offset! -= 2
    this.view.setUint16(offset!, value, this.littleEndian)
    if (relative) {
      this.offset += 2
    }
    return this
  }

  /**
   * Writes a 16bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint16}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @throws {TypeError} If `offset` or `value` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  writeUInt16 = this.writeUint16

  /**
   * Reads a 16bit unsigned integer.
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @returns {number} Value read
   * @throws {TypeError} If `offset` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  readUint16(offset?: number): number {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 2 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 2 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getUint16(offset!, this.littleEndian)
    if (relative) {
      this.offset += 2
    }
    return value
  }

  /**
   * Reads a 16bit unsigned integer. This is an alias of {@link ByteBuffer#readUint16}.
   * @function
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
   * @returns {number} Value read
   * @throws {TypeError} If `offset` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @expose
   */
  readUInt16 = this.readUint16

  // types/ints/int32

  /**
   * Writes a 32bit signed integer.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @expose
   */
  writeInt32(value: number, offset?: number) {
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
    offset! += 4
    let capacity4 = this.buffer.byteLength
    if (offset! > capacity4) {
      this.resize((capacity4 *= 2) > offset! ? capacity4 : offset!)
    }
    offset! -= 4
    this.view.setInt32(offset!, value, this.littleEndian)
    if (relative) {
      this.offset += 4
    }
    return this
  }

  /**
   * Writes a 32bit signed integer. This is an alias of {@link ByteBuffer#writeInt32}.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @expose
   */
  writeInt = this.writeInt32

  /**
   * Reads a 32bit signed integer.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readInt32(offset?: number): number {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 4 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 4 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getInt32(offset!, this.littleEndian)
    if (relative) {
      this.offset += 4
    }
    return value
  }

  /**
   * Reads a 32bit signed integer. This is an alias of {@link ByteBuffer#readInt32}.
   * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readInt = this.readInt32

  /**
   * Writes a 32bit unsigned integer.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @expose
   */
  writeUint32(value: number, offset?: number) {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof value !== 'number' || value % 1 !== 0) {
        throw TypeError('Illegal value: ' + value + ' (not an integer)')
      }
      value >>>= 0
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
    offset! += 4
    let capacity5 = this.buffer.byteLength
    if (offset! > capacity5) {
      this.resize((capacity5 *= 2) > offset! ? capacity5 : offset!)
    }
    offset! -= 4
    this.view.setUint32(offset!, value, this.littleEndian)
    if (relative) {
      this.offset += 4
    }
    return this
  }

  /**
   * Writes a 32bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint32}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @expose
   */
  writeUInt32 = this.writeUint32

  /**
   * Reads a 32bit unsigned integer.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readUint32(offset?: number): number {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 4 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 4 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getUint32(offset!, this.littleEndian)
    if (relative) {
      this.offset += 4
    }
    return value
  }

  /**
   * Reads a 32bit unsigned integer. This is an alias of {@link ByteBuffer#readUint32}.
   * @function
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {number} Value read
   * @expose
   */
  readUInt32 = this.readUint32

  /**
   * Writes a 32bit float.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeFloat32(value: number, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof value !== 'number') {
        throw TypeError('Illegal value: ' + value + ' (not a number)')
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
    offset! += 4
    let capacity8 = this.buffer.byteLength
    if (offset! > capacity8) {
      this.resize((capacity8 *= 2) > offset! ? capacity8 : offset!)
    }
    offset! -= 4
    this.view.setFloat32(offset!, value, this.littleEndian)
    if (relative) {
      this.offset += 4
    }
    return this
  }

  /**
   * Writes a 32bit float. This is an alias of {@link ByteBuffer#writeFloat32}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeFloat = this.writeFloat32

  /**
   * Reads a 32bit float.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {number}
   * @expose
   */
  readFloat32(offset?: number): number {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 4 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 4 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getFloat32(offset!, this.littleEndian)
    if (relative) {
      this.offset += 4
    }
    return value
  }

  /**
   * Reads a 32bit float. This is an alias of {@link ByteBuffer#readFloat32}.
   * @function
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
   * @returns {number}
   * @expose
   */
  readFloat = this.readFloat32

  // types/floats/float64

  /**
   * Writes a 64bit float.
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeFloat64(value: number, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof value !== 'number') {
        throw TypeError('Illegal value: ' + value + ' (not a number)')
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
    offset! += 8
    let capacity9 = this.buffer.byteLength
    if (offset! > capacity9) {
      this.resize((capacity9 *= 2) > offset! ? capacity9 : offset!)
    }
    offset! -= 8
    this.view.setFloat64(offset!, value, this.littleEndian)
    if (relative) {
      this.offset += 8
    }
    return this
  }

  /**
   * Writes a 64bit float. This is an alias of {@link ByteBuffer#writeFloat64}.
   * @function
   * @param {number} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeDouble = this.writeFloat64

  /**
   * Reads a 64bit float.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {number}
   * @expose
   */
  readFloat64(offset?: number): number {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 8 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 8 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getFloat64(offset!, this.littleEndian)
    if (relative) {
      this.offset += 8
    }
    return value
  }

  /**
   * Reads a 64bit float. This is an alias of {@link ByteBuffer#readFloat64}.
   * @function
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {number}
   * @expose
   */
  readDouble = this.readFloat64

  /**
   * Appends some data to this ByteBuffer. This will overwrite any contents behind the specified offset up to the appended
   *  data's length.
   * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array} source Data to append. If `source` is a ByteBuffer, its offsets
   *  will be modified according to the performed read operation.
   * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
   * @param {number=} offset Offset to append at. Will use and increase {@link ByteBuffer#offset} by the number of bytes
   *  written if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   * @example A relative `<01 02>03.append(<04 05>)` will result in `<01 02 04 05>, 04 05|`
   * @example An absolute `<01 02>03.append(04 05>, 1)` will result in `<01 04>05, 04 05|`
   */
  append(source: ByteBuffer | ArrayBuffer | Uint8Array, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
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
    if (!(source instanceof ByteBuffer)) {
      source = ByteBuffer.wrap(source)
    }
    const length = source.limit - source.offset
    if (length <= 0) {
      return this
    } // Nothing to append
    offset! += length
    let capacity16 = this.buffer.byteLength
    if (offset! > capacity16) {
      this.resize((capacity16 *= 2) > offset! ? capacity16 : offset!)
    }
    offset! -= length
    new Uint8Array(this.buffer, offset).set(
      new Uint8Array(source.buffer).subarray(source.offset, source.limit),
    )
    source.offset += length
    if (relative) {
      this.offset += length
    }
    return this
  }

  /**
     * Appends this ByteBuffer's contents to another ByteBuffer. This will overwrite any contents at and after the
        specified offset up to the length of this ByteBuffer's data.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} offset Offset to append to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @see ByteBuffer#append
     */
  appendTo(target: ByteBuffer, offset?: number): ByteBuffer {
    target.append(this, offset)
    return this
  }

  /**
   * Enables or disables assertions of argument types and offsets. Assertions are enabled by default but you can opt to
   *  disable them if your code already makes sure that everything is valid.
   * @param {boolean} assert `true` to enable assertions, otherwise `false`
   * @returns {!ByteBuffer} this
   * @expose
   */
  assert(assert: boolean): ByteBuffer {
    this.noAssert = !assert
    return this
  }

  /**
   * Gets the capacity of this ByteBuffer's backing buffer.
   * @returns {number} Capacity of the backing buffer
   * @expose
   */
  capacity(): number {
    return this.buffer.byteLength
  }

  /**
   * Clears this ByteBuffer's offsets by setting {@link ByteBuffer#offset} to `0` and {@link ByteBuffer#limit} to the
   *  backing buffer's capacity. Discards {@link ByteBuffer#markedOffset}.
   * @returns {!ByteBuffer} this
   * @expose
   */
  clear(): ByteBuffer {
    this.offset = 0
    this.limit = this.buffer.byteLength
    this.markedOffset = -1
    return this
  }

  /**
   * Creates a cloned instance of this ByteBuffer, preset with this ByteBuffer's values for {@link ByteBuffer#offset},
   *  {@link ByteBuffer#markedOffset} and {@link ByteBuffer#limit}.
   * @param {boolean=} copy Whether to copy the backing buffer or to return another view on the same, defaults to `false`
   * @returns {!ByteBuffer} Cloned instance
   * @expose
   */
  clone(copy?: boolean): ByteBuffer {
    const bb = new ByteBuffer(0, this.littleEndian, this.noAssert)
    if (copy) {
      bb.buffer = new ArrayBuffer(this.buffer.byteLength)
      new Uint8Array(bb.buffer).set(this.buffer as any)
      bb.view = new DataView(bb.buffer)
    } else {
      bb.buffer = this.buffer
      bb.view = this.view
    }
    bb.offset = this.offset
    bb.markedOffset = this.markedOffset
    bb.limit = this.limit
    return bb
  }

  /**
   * Compacts this ByteBuffer to be backed by a {@link ByteBuffer#buffer} of its contents' length. Contents are the bytes
   *  between {@link ByteBuffer#offset} and {@link ByteBuffer#limit}. Will set `offset = 0` and `limit = capacity` and
   *  adapt {@link ByteBuffer#markedOffset} to the same relative position if set.
   * @param {number=} begin Offset to start at, defaults to {@link ByteBuffer#offset}
   * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
   * @returns {!ByteBuffer} this
   * @expose
   */
  compact(begin: number | undefined, end: number | undefined): ByteBuffer {
    if (typeof begin === 'undefined') {
      begin = this.offset
    }
    if (typeof end === 'undefined') {
      end = this.limit
    }
    if (!this.noAssert) {
      if (typeof begin !== 'number' || begin % 1 !== 0) {
        throw TypeError('Illegal begin: Not an integer')
      }
      begin >>>= 0
      if (typeof end !== 'number' || end % 1 !== 0) {
        throw TypeError('Illegal end: Not an integer')
      }
      end >>>= 0
      if (begin < 0 || begin > end || end > this.buffer.byteLength) {
        throw RangeError(
          'Illegal range: 0 <= ' + begin + ' <= ' + end + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    if (begin === 0 && end === this.buffer.byteLength) {
      return this
    } // Already compacted
    const len = end - begin
    if (len === 0) {
      this.buffer = EMPTY_BUFFER
      this.view = new DataView(EMPTY_BUFFER)
      if (this.markedOffset >= 0) {
        this.markedOffset -= begin
      }
      this.offset = 0
      this.limit = 0
      return this
    }
    const buffer = new ArrayBuffer(len)
    new Uint8Array(buffer).set(new Uint8Array(this.buffer).subarray(begin, end))
    this.buffer = buffer
    this.view = new DataView(buffer)
    if (this.markedOffset >= 0) {
      this.markedOffset -= begin
    }
    this.offset = 0
    this.limit = len
    return this
  }

  /**
   * Creates a copy of this ByteBuffer's contents. Contents are the bytes between {@link ByteBuffer#offset} and
   *  {@link ByteBuffer#limit}.
   * @param {number=} begin Begin offset, defaults to {@link ByteBuffer#offset}.
   * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
   * @returns {!ByteBuffer} Copy
   * @expose
   */
  copy(begin: number | undefined, end: number | undefined): ByteBuffer {
    if (typeof begin === 'undefined') {
      begin = this.offset
    }
    if (typeof end === 'undefined') {
      end = this.limit
    }
    if (!this.noAssert) {
      if (typeof begin !== 'number' || begin % 1 !== 0) {
        throw TypeError('Illegal begin: Not an integer')
      }
      begin >>>= 0
      if (typeof end !== 'number' || end % 1 !== 0) {
        throw TypeError('Illegal end: Not an integer')
      }
      end >>>= 0
      if (begin < 0 || begin > end || end > this.buffer.byteLength) {
        throw RangeError(
          'Illegal range: 0 <= ' + begin + ' <= ' + end + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    if (begin === end) {
      return new ByteBuffer(0, this.littleEndian, this.noAssert)
    }
    const capacity = end - begin
    const bb = new ByteBuffer(capacity, this.littleEndian, this.noAssert)
    bb.offset = 0
    bb.limit = capacity
    if (bb.markedOffset >= 0) {
      bb.markedOffset -= begin
    }
    this.copyTo(bb, 0, begin, end)
    return bb
  }

  /**
   * Copies this ByteBuffer's contents to another ByteBuffer. Contents are the bytes between {@link ByteBuffer#offset} and
   *  {@link ByteBuffer#limit}.
   * @param {!ByteBuffer} target Target ByteBuffer
   * @param {number=} targetOffset Offset to copy to. Will use and increase the target's {@link ByteBuffer#offset}
   *  by the number of bytes copied if omitted.
   * @param {number=} sourceOffset Offset to start copying from. Will use and increase {@link ByteBuffer#offset} by the
   *  number of bytes copied if omitted.
   * @param {number=} sourceLimit Offset to end copying from, defaults to {@link ByteBuffer#limit}
   * @returns {!ByteBuffer} this
   * @expose
   */
  copyTo(
    target: ByteBuffer,
    targetOffset?: number,
    sourceOffset?: number,
    sourceLimit?: number,
  ): ByteBuffer {
    let relative, targetRelative
    if (!this.noAssert) {
      if (!(target instanceof ByteBuffer)) {
        throw TypeError('Illegal target: Not a ByteBuffer')
      }
    }
    // eslint-disable-next-line no-cond-assign
    targetOffset = (targetRelative = typeof targetOffset === 'undefined')
      ? target.offset
      : targetOffset | 0
    // eslint-disable-next-line no-cond-assign
    sourceOffset = (relative = typeof sourceOffset === 'undefined') ? this.offset : sourceOffset | 0
    sourceLimit = typeof sourceLimit === 'undefined' ? this.limit : sourceLimit | 0

    if (targetOffset < 0 || targetOffset > target.buffer.byteLength) {
      throw RangeError(
        'Illegal target range: 0 <= ' + targetOffset + ' <= ' + target.buffer.byteLength,
      )
    }
    if (sourceOffset < 0 || sourceLimit > this.buffer.byteLength) {
      throw RangeError(
        'Illegal source range: 0 <= ' + sourceOffset + ' <= ' + this.buffer.byteLength,
      )
    }

    const len = sourceLimit - sourceOffset
    if (len === 0) {
      return target
    } // Nothing to copy

    target.ensureCapacity(targetOffset + len)

    new Uint8Array(target.buffer).set(
      new Uint8Array(this.buffer).subarray(sourceOffset, sourceLimit),
      targetOffset,
    )

    if (relative) {
      this.offset += len
    }
    if (targetRelative) {
      target.offset += len
    }

    return this
  }

  /**
   * Makes sure that this ByteBuffer is backed by a {@link ByteBuffer#buffer} of at least the specified capacity. If the
   *  current capacity is exceeded, it will be doubled. If double the current capacity is less than the required capacity,
   *  the required capacity will be used instead.
   * @param {number} capacity Required capacity
   * @returns {!ByteBuffer} this
   * @expose
   */
  ensureCapacity(capacity: number): ByteBuffer {
    let current = this.buffer.byteLength
    if (current < capacity) {
      return this.resize((current *= 2) > capacity ? current : capacity)
    }
    return this
  }

  /**
   * Overwrites this ByteBuffer's contents with the specified value. Contents are the bytes between
   *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}.
   * @param {number|string} value Byte value to fill with. If given as a string, the first character is used.
   * @param {number=} begin Begin offset. Will use and increase {@link ByteBuffer#offset} by the number of bytes
   *  written if omitted. defaults to {@link ByteBuffer#offset}.
   * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
   * @returns {!ByteBuffer} this
   * @expose
   * @example `someByteBuffer.clear().fill(0)` fills the entire backing buffer with zeroes
   */
  fill(value: number | string, begin?: number, end?: number): ByteBuffer {
    const relative = typeof begin === 'undefined'
    if (relative) {
      begin = this.offset
    }
    if (typeof value === 'string' && value.length > 0) {
      value = value.charCodeAt(0)
    }
    if (typeof begin === 'undefined') {
      begin = this.offset
    }
    if (typeof end === 'undefined') {
      end = this.limit
    }
    if (!this.noAssert) {
      if (typeof value !== 'number' || value % 1 !== 0) {
        throw TypeError('Illegal value: ' + value + ' (not an integer)')
      }
      value |= 0
      if (typeof begin !== 'number' || begin % 1 !== 0) {
        throw TypeError('Illegal begin: Not an integer')
      }
      begin >>>= 0
      if (typeof end !== 'number' || end % 1 !== 0) {
        throw TypeError('Illegal end: Not an integer')
      }
      end >>>= 0
      if (begin < 0 || begin > end || end > this.buffer.byteLength) {
        throw RangeError(
          'Illegal range: 0 <= ' + begin + ' <= ' + end + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    if (begin >= end) {
      return this
    } // Nothing to fill
    while (begin < end) {
      this.view.setUint8(begin++, value as number)
    }
    if (relative) {
      this.offset = begin
    }
    return this
  }

  /**
   * Makes this ByteBuffer ready for a new sequence of write or relative read operations. Sets `limit = offset` and
   *  `offset = 0`. Make sure always to flip a ByteBuffer when all relative read or write operations are complete.
   * @returns {!ByteBuffer} this
   * @expose
   */
  flip(): ByteBuffer {
    this.limit = this.offset
    this.offset = 0
    return this
  }

  /**
   * Marks an offset on this ByteBuffer to be used later.
   * @param {number=} offset Offset to mark. Defaults to {@link ByteBuffer#offset}.
   * @returns {!ByteBuffer} this
   * @throws {TypeError} If `offset` is not a valid number
   * @throws {RangeError} If `offset` is out of bounds
   * @see ByteBuffer#reset
   * @expose
   */
  mark(offset?: number): ByteBuffer {
    offset = typeof offset === 'undefined' ? this.offset : offset
    if (!this.noAssert) {
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
    this.markedOffset = offset
    return this
  }

  /**
   * Sets the byte order.
   * @param {boolean} littleEndian `true` for little endian byte order, `false` for big endian
   * @returns {!ByteBuffer} this
   * @expose
   */
  order(littleEndian: boolean): ByteBuffer {
    if (!this.noAssert) {
      if (typeof littleEndian !== 'boolean') {
        throw TypeError('Illegal littleEndian: Not a boolean')
      }
    }
    this.littleEndian = !!littleEndian
    return this
  }

  /**
   * Switches (to) little endian byte order.
   * @param {boolean=} littleEndian Defaults to `true`, otherwise uses big endian
   * @returns {!ByteBuffer} this
   * @expose
   */
  LE(littleEndian: boolean | undefined): ByteBuffer {
    this.littleEndian = typeof littleEndian !== 'undefined' ? !!littleEndian : true
    return this
  }

  /**
   * Switches (to) big endian byte order.
   * @param {boolean=} bigEndian Defaults to `true`, otherwise uses little endian
   * @returns {!ByteBuffer} this
   * @expose
   */
  BE(bigEndian: boolean | undefined): ByteBuffer {
    this.littleEndian = typeof bigEndian !== 'undefined' ? !bigEndian : false
    return this
  }

  /**
   * Prepends some data to this ByteBuffer. This will overwrite any contents before the specified offset up to the
   *  prepended data's length. If there is not enough space available before the specified `offset`, the backing buffer
   *  will be resized and its contents moved accordingly.
   * @param {!ByteBuffer|!ArrayBuffer} source Data to prepend. If `source` is a ByteBuffer, its offset will be
   *  modified according to the performed read operation.
   * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
   * @param {number=} offset Offset to prepend at. Will use and decrease {@link ByteBuffer#offset} by the number of bytes
   *  prepended if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   * @example A relative `00<01 02 03>.prepend(<04 05>)` results in `<04 05 01 02 03>, 04 05|`
   * @example An absolute `00<01 02 03>.prepend(<04 05>, 2)` results in `04<05 02 03>, 04 05|`
   */
  prepend(source: ByteBuffer | ArrayBuffer, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
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
    if (!(source instanceof ByteBuffer)) {
      source = ByteBuffer.wrap(source)
    }
    const len = source.limit - source.offset
    if (len <= 0) {
      return this
    } // Nothing to prepend
    const diff = len - offset!
    if (diff > 0) {
      // Not enough space before offset, so resize + move
      const buffer = new ArrayBuffer(this.buffer.byteLength + diff)
      const arrayView = new Uint8Array(buffer)
      arrayView.set(new Uint8Array(this.buffer).subarray(offset, this.buffer.byteLength), len)
      this.buffer = buffer
      this.view = new DataView(buffer)
      this.offset += diff
      if (this.markedOffset >= 0) {
        this.markedOffset += diff
      }
      this.limit += diff
      offset! += diff
    } else {
      const arrayView = new Uint8Array(this.buffer)
      arrayView.set(
        new Uint8Array(source.buffer).subarray(source.offset, source.limit),
        offset! - len,
      )
    }

    source.offset = source.limit
    if (relative) {
      this.offset -= len
    }
    return this
  }

  /**
   * Prepends this ByteBuffer to another ByteBuffer. This will overwrite any contents before the specified offset up to the
   *  prepended data's length. If there is not enough space available before the specified `offset`, the backing buffer
   *  will be resized and its contents moved accordingly.
   * @param {!ByteBuffer} target Target ByteBuffer
   * @param {number=} offset Offset to prepend at. Will use and decrease {@link ByteBuffer#offset} by the number of bytes
   *  prepended if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   * @see ByteBuffer#prepend
   */
  prependTo(target: ByteBuffer, offset?: number): ByteBuffer {
    target.prepend(this, offset)
    return this
  }

  /**
   * Gets the number of remaining readable bytes. Contents are the bytes between {@link ByteBuffer#offset} and
   *  {@link ByteBuffer#limit}, so this returns `limit - offset`.
   * @returns {number} Remaining readable bytes. May be negative if `offset > limit`.
   * @expose
   */
  remaining(): number {
    return this.limit - this.offset
  }

  /**
   * Resets this ByteBuffer's {@link ByteBuffer#offset}. If an offset has been marked through {@link ByteBuffer#mark}
   *  before, `offset` will be set to {@link ByteBuffer#markedOffset}, which will then be discarded. If no offset has been
   *  marked, sets `offset = 0`.
   * @returns {!ByteBuffer} this
   * @see ByteBuffer#mark
   * @expose
   */
  reset(): ByteBuffer {
    if (this.markedOffset >= 0) {
      this.offset = this.markedOffset
      this.markedOffset = -1
    } else {
      this.offset = 0
    }
    return this
  }

  /**
   * Resizes this ByteBuffer to be backed by a buffer of at least the given capacity. Will do nothing if already that
   *  large or larger.
   * @param {number} capacity Capacity required
   * @returns {!ByteBuffer} this
   * @throws {TypeError} If `capacity` is not a number
   * @throws {RangeError} If `capacity < 0`
   * @expose
   */
  resize(capacity: number): ByteBuffer {
    if (!this.noAssert) {
      if (typeof capacity !== 'number' || capacity % 1 !== 0) {
        throw TypeError('Illegal capacity: ' + capacity + ' (not an integer)')
      }
      capacity |= 0
      if (capacity < 0) {
        throw RangeError('Illegal capacity: 0 <= ' + capacity)
      }
    }
    if (this.buffer.byteLength < capacity) {
      const buffer = new ArrayBuffer(capacity)
      new Uint8Array(buffer).set(new Uint8Array(this.buffer))
      this.buffer = buffer
      this.view = new DataView(buffer)
    }
    return this
  }

  /**
   * Reverses this ByteBuffer's contents.
   * @param {number=} begin Offset to start at, defaults to {@link ByteBuffer#offset}
   * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
   * @returns {!ByteBuffer} this
   * @expose
   */
  reverse(begin: number | undefined, end: number | undefined): ByteBuffer {
    if (typeof begin === 'undefined') {
      begin = this.offset
    }
    if (typeof end === 'undefined') {
      end = this.limit
    }
    if (!this.noAssert) {
      if (typeof begin !== 'number' || begin % 1 !== 0) {
        throw TypeError('Illegal begin: Not an integer')
      }
      begin >>>= 0
      if (typeof end !== 'number' || end % 1 !== 0) {
        throw TypeError('Illegal end: Not an integer')
      }
      end >>>= 0
      if (begin < 0 || begin > end || end > this.buffer.byteLength) {
        throw RangeError(
          'Illegal range: 0 <= ' + begin + ' <= ' + end + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    if (begin === end) {
      return this
    } // Nothing to reverse
    Array.prototype.reverse.call(new Uint8Array(this.buffer).subarray(begin, end))
    this.view = new DataView(this.buffer) // FIXME: Why exactly is this necessary?
    return this
  }

  /**
   * Skips the next `length` bytes. This will just advance
   * @param {number} length Number of bytes to skip. May also be negative to move the offset back.
   * @returns {!ByteBuffer} this
   * @expose
   */
  skip(length: number): ByteBuffer {
    if (!this.noAssert) {
      if (typeof length !== 'number' || length % 1 !== 0) {
        throw TypeError('Illegal length: ' + length + ' (not an integer)')
      }
      length |= 0
    }
    const offset = this.offset + length
    if (!this.noAssert) {
      if (offset < 0 || offset > this.buffer.byteLength) {
        throw RangeError(
          'Illegal length: 0 <= ' + this.offset + ' + ' + length + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    this.offset = offset
    return this
  }

  /**
   * Slices this ByteBuffer by creating a cloned instance with `offset = begin` and `limit = end`.
   * @param {number=} begin Begin offset, defaults to {@link ByteBuffer#offset}.
   * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
   * @returns {!ByteBuffer} Clone of this ByteBuffer with slicing applied, backed by the same {@link ByteBuffer#buffer}
   * @expose
   */
  slice(begin?: number, end?: number): ByteBuffer {
    if (typeof begin === 'undefined') {
      begin = this.offset
    }
    if (typeof end === 'undefined') {
      end = this.limit
    }
    if (!this.noAssert) {
      if (typeof begin !== 'number' || begin % 1 !== 0) {
        throw TypeError('Illegal begin: Not an integer')
      }
      begin >>>= 0
      if (typeof end !== 'number' || end % 1 !== 0) {
        throw TypeError('Illegal end: Not an integer')
      }
      end >>>= 0
      if (begin < 0 || begin > end || end > this.buffer.byteLength) {
        throw RangeError(
          'Illegal range: 0 <= ' + begin + ' <= ' + end + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    const bb = this.clone()
    bb.offset = begin
    bb.limit = end
    return bb
  }

  /**
   * Writes a 64bit signed integer.
   * @param {number|bigint} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeInt64(value: bigint | number, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (typeof offset === 'undefined') {
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
    offset += 8
    let capacity6 = this.buffer.byteLength
    if (offset > capacity6) {
      this.resize((capacity6 *= 2) > offset ? capacity6 : offset)
    }
    offset -= 8
    this.view.setBigInt64(offset, value, this.littleEndian)
    if (relative) {
      this.offset += 8
    }
    return this
  }

  /**
   * Writes a 64bit signed integer. This is an alias of {@link ByteBuffer#writeInt64}.
   * @param {number|!bigint} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeLong = this.writeInt64

  /**
   * Reads a 64bit signed integer.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!bigint}
   * @expose
   */
  readInt64(offset?: number): bigint {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 8 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 8 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getBigInt64(offset!, this.littleEndian)
    if (relative) {
      this.offset += 8
    }
    return value
  }

  /**
   * Reads a 64bit signed integer. This is an alias of {@link ByteBuffer#readInt64}.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!bigint}
   * @expose
   */
  readLong = this.readInt64

  /**
   * Writes a 64bit unsigned integer.
   * @param {number|!bigint} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeUint64(value: number | bigint, offset?: number): ByteBuffer {
    const relative = typeof offset === 'undefined'
    if (typeof offset === 'undefined') {
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
    offset += 8
    let capacity7 = this.buffer.byteLength
    if (offset > capacity7) {
      this.resize((capacity7 *= 2) > offset ? capacity7 : offset)
    }
    offset -= 8
    this.view.setBigUint64(offset, value, this.littleEndian)
    if (relative) {
      this.offset += 8
    }
    return this
  }

  /**
   * Writes a 64bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint64}.
   * @function
   * @param {number|!bigint} value Value to write
   * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!ByteBuffer} this
   * @expose
   */
  writeUInt64 = this.writeUint64

  /**
   * Reads a 64bit unsigned integer.
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!bigint}
   * @expose
   */
  readUint64(offset?: number): bigint {
    const relative = typeof offset === 'undefined'
    if (relative) {
      offset = this.offset
    }
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: ' + offset + ' (not an integer)')
      }
      offset >>>= 0
      if (offset < 0 || offset + 8 > this.buffer.byteLength) {
        throw RangeError(
          'Illegal offset: 0 <= ' + offset + ' (+' + 8 + ') <= ' + this.buffer.byteLength,
        )
      }
    }
    const value = this.view.getBigUint64(offset!, this.littleEndian)
    if (relative) {
      this.offset += 8
    }
    return value
  }

  /**
   * Reads a 64bit unsigned integer. This is an alias of {@link ByteBuffer#readUint64}.
   * @function
   * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
   * @returns {!Long}
   * @expose
   */
  readUInt64 = this.readUint64

  /**
   * Returns a copy of the backing buffer that contains this ByteBuffer's contents. Contents are the bytes between
   *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}.
   * @param {boolean=} forceCopy If `true` returns a copy, otherwise returns a view referencing the same memory if
   *  possible. Defaults to `false`
   * @returns {!ArrayBuffer} Contents as an ArrayBuffer
   * @expose
   */
  toBuffer(forceCopy?: boolean): ArrayBuffer {
    let offset = this.offset
    let limit = this.limit
    if (!this.noAssert) {
      if (typeof offset !== 'number' || offset % 1 !== 0) {
        throw TypeError('Illegal offset: Not an integer')
      }
      offset >>>= 0
      if (typeof limit !== 'number' || limit % 1 !== 0) {
        throw TypeError('Illegal limit: Not an integer')
      }
      limit >>>= 0
      if (offset < 0 || offset > limit || limit > this.buffer.byteLength) {
        throw RangeError(
          'Illegal range: 0 <= ' + offset + ' <= ' + limit + ' <= ' + this.buffer.byteLength,
        )
      }
    }
    if (!forceCopy) {
      // NOTE: It's not possible to have another ArrayBuffer reference the same memory as the backing buffer. This is
      // possible with Uint8Array#subarray only, but we have to return an ArrayBuffer by contract. So:
      if (offset === 0 && limit === this.buffer.byteLength) {
        return this.buffer
      }

      return this.buffer.slice(offset, limit)
    }
    if (offset === limit) {
      return EMPTY_BUFFER
    }
    const buffer = new ArrayBuffer(limit - offset)
    new Uint8Array(buffer).set(new Uint8Array(this.buffer).subarray(offset, limit), 0)
    return buffer
  }

  /**
   * Returns a raw buffer compacted to contain this ByteBuffer's contents. Contents are the bytes between
   *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}. This is an alias of {@link ByteBuffer#toBuffer}.
   * @function
   * @param {boolean=} forceCopy If `true` returns a copy, otherwise returns a view referencing the same memory.
   *  Defaults to `false`
   * @returns {!ArrayBuffer} Contents as an ArrayBuffer
   * @expose
   */
  toArrayBuffer = this.toBuffer
}

// helpers

/**
 * @type {!ArrayBuffer}
 * @inner
 */
const EMPTY_BUFFER: ArrayBuffer = new ArrayBuffer(0)
