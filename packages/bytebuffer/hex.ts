import { ByteBuffer } from '.'
// encodings/hex
declare module './index' {
  interface ByteBuffer {
    toHex(begin: number | undefined, end: number | undefined): string
  }
}

/**
 * Encodes this ByteBuffer's contents to a hex encoded string.
 * @param {number=} begin Offset to begin at. Defaults to {@link ByteBuffer#offset}.
 * @param {number=} end Offset to end at. Defaults to {@link ByteBuffer#limit}.
 * @returns {string} Hex encoded string
 * @expose
 */
ByteBuffer.prototype.toHex = function (begin?: number, end?: number): string {
  begin = typeof begin === 'undefined' ? this.offset : begin
  end = typeof end === 'undefined' ? this.limit : end
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
  const out = new Array(end - begin)
  let b
  while (begin < end) {
    b = this.view.getUint8(begin++)
    if (b < 0x10) {
      out.push('0', b.toString(16))
    } else {
      out.push(b.toString(16))
    }
  }
  return out.join('')
}

/**
 * Decodes a hex encoded string to a ByteBuffer.
 * @param {string} str String to decode
 * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
 *  {@link ByteBuffer.DEFAULT_ENDIAN}.
 * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
 *  {@link ByteBuffer.DEFAULT_NOASSERT}.
 * @returns {!ByteBuffer} ByteBuffer
 * @expose
 */
export const fromHex = function (
  str: string,
  littleEndian: boolean | undefined,
  noAssert: boolean | undefined,
): ByteBuffer {
  if (!noAssert) {
    if (typeof str !== 'string') {
      throw TypeError('Illegal str: Not a string')
    }
    if (str.length % 2 !== 0) {
      throw TypeError('Illegal str: Length not a multiple of 2')
    }
  }
  const k = str.length
  const bb = new ByteBuffer((k / 2) | 0, littleEndian)
  let b
  let j = 0
  for (let i = 0; i < k; i += 2) {
    b = parseInt(str.substring(i, i + 2), 16)
    if (!noAssert) {
      if (!isFinite(b) || b < 0 || b > 255) {
        throw TypeError('Illegal str: Contains non-hex characters')
      }
    }
    bb.view.setUint8(j++, b)
  }
  bb.limit = j
  return bb
}
