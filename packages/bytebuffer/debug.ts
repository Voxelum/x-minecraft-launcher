// encodings/debug

import { ByteBuffer } from '.'

/**
 * Encodes this ByteBuffer to a hex encoded string with marked offsets. Offset symbols are:
 * * `<` : offset,
 * * `'` : markedOffset,
 * * `>` : limit,
 * * `|` : offset and limit,
 * * `[` : offset and markedOffset,
 * * `]` : markedOffset and limit,
 * * `!` : offset, markedOffset and limit
 * @param {boolean=} columns If `true` returns two columns hex + ascii, defaults to `false`
 * @returns {string|!Array.<string>} Debug string or array of lines if `asArray = true`
 * @expose
 * @example `>00'01 02<03` contains four bytes with `limit=0, markedOffset=1, offset=3`
 * @example `00[01 02 03>` contains four bytes with `offset=markedOffset=1, limit=4`
 * @example `00|01 02 03` contains four bytes with `offset=limit=1, markedOffset=-1`
 * @example `|` contains zero bytes with `offset=limit=0, markedOffset=-1`
 */
export function toDebug(bb: ByteBuffer, columns: boolean | undefined): string | Array<string> {
  let i = -1
  const k = bb.buffer.byteLength
  let b
  let hex = ''
  let asc = ''
  let out = ''
  while (i < k) {
    if (i !== -1) {
      b = bb.view.getUint8(i)
      if (b < 0x10) {
        hex += '0' + b.toString(16).toUpperCase()
      } else {
        hex += b.toString(16).toUpperCase()
      }
      if (columns) {
        asc += b > 32 && b < 127 ? String.fromCharCode(b) : '.'
      }
    }
    ++i
    if (columns) {
      if (i > 0 && i % 16 === 0 && i !== k) {
        while (hex.length < 3 * 16 + 3) {
          hex += ' '
        }
        out += hex + asc + '\n'
        hex = asc = ''
      }
    }
    if (i === bb.offset && i === bb.limit) {
      hex += i === bb.markedOffset ? '!' : '|'
    } else if (i === bb.offset) {
      hex += i === bb.markedOffset ? '[' : '<'
    } else if (i === bb.limit) {
      hex += i === bb.markedOffset ? ']' : '>'
    } else {
      hex += i === bb.markedOffset ? "'" : columns || (i !== 0 && i !== k) ? ' ' : ''
    }
  }
  if (columns && hex !== ' ') {
    while (hex.length < 3 * 16 + 3) {
      hex += ' '
    }
    out += hex + asc + '\n'
  }
  return columns ? out : hex
}

/**
 * Prints debug information about this ByteBuffer's contents.
 * @param {function(string)=} out Output function to call, defaults to console.log
 * @expose
 */
export function printDebug(buf: ByteBuffer, out: ((arg0: string) => any) | undefined) {
  // eslint-disable-next-line no-console
  if (typeof out !== 'function') {
    out = console.log.bind(console)
  }
  out(
    buf.toString() +
      '\n' +
      '-------------------------------------------------------------------\n' +
      toDebug(buf, /* columns */ true),
  )
}

/**
 * Decodes a hex encoded string with marked offsets to a ByteBuffer.
 * @param {string} str Debug string to decode (not be generated with `columns = true`)
 * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
 *  {@link ByteBuffer.DEFAULT_ENDIAN}.
 * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
 *  {@link ByteBuffer.DEFAULT_NOASSERT}.
 * @returns {!ByteBuffer} ByteBuffer
 * @expose
 * @see ByteBuffer#toDebug
 */
export function fromDebug(
  str: string,
  littleEndian: boolean | undefined,
  noAssert: boolean | undefined,
): ByteBuffer {
  const k = str.length
  const bb = new ByteBuffer(((k + 1) / 3) | 0, littleEndian, noAssert)
  let i = 0
  let j = 0
  let ch
  let b
  let rs = false // Require symbol next
  let ho = false
  let hm = false
  let hl = false // Already has offset (ho), markedOffset (hm), limit (hl)?
  let fail = false
  while (i < k) {
    switch ((ch = str.charAt(i++))) {
      case '!':
        if (!noAssert) {
          if (ho || hm || hl) {
            fail = true
            break
          }
          ho = hm = hl = true
        }
        bb.offset = bb.markedOffset = bb.limit = j
        rs = false
        break
      case '|':
        if (!noAssert) {
          if (ho || hl) {
            fail = true
            break
          }
          ho = hl = true
        }
        bb.offset = bb.limit = j
        rs = false
        break
      case '[':
        if (!noAssert) {
          if (ho || hm) {
            fail = true
            break
          }
          ho = hm = true
        }
        bb.offset = bb.markedOffset = j
        rs = false
        break
      case '<':
        if (!noAssert) {
          if (ho) {
            fail = true
            break
          }
          ho = true
        }
        bb.offset = j
        rs = false
        break
      case ']':
        if (!noAssert) {
          if (hl || hm) {
            fail = true
            break
          }
          hl = hm = true
        }
        bb.limit = bb.markedOffset = j
        rs = false
        break
      case '>':
        if (!noAssert) {
          if (hl) {
            fail = true
            break
          }
          hl = true
        }
        bb.limit = j
        rs = false
        break
      case "'":
        if (!noAssert) {
          if (hm) {
            fail = true
            break
          }
          hm = true
        }
        bb.markedOffset = j
        rs = false
        break
      case ' ':
        rs = false
        break
      default:
        if (!noAssert) {
          if (rs) {
            fail = true
            break
          }
        }
        b = parseInt(ch + str.charAt(i++), 16)
        if (!noAssert) {
          if (isNaN(b) || b < 0 || b > 255) {
            throw TypeError('Illegal str: Not a debug encoded string')
          }
        }
        bb.view.setUint8(j++, b)
        rs = true
    }
    if (fail) {
      throw TypeError('Illegal str: Invalid symbol at ' + i)
    }
  }
  if (!noAssert) {
    if (!ho || !hl) {
      throw TypeError('Illegal str: Missing offset or limit')
    }
    if (j < bb.buffer.byteLength) {
      throw TypeError('Illegal str: Not a debug encoded string (is it hex?) ' + j + ' < ' + k)
    }
  }
  return bb
}
