import { ByteBuffer } from '@xmcl/bytebuffer'
import type { ReadContext, WriteContext } from './index'

export function writeUTF8(out: ByteBuffer, str = '', context: WriteContext) {
  const strlen = str.length
  let utflen = 0
  let c: number

  /* use charAt instead of copying String to char array */
  for (let idx = 0; idx < strlen; idx++) {
    c = str.charCodeAt(idx)
    if (c >= 0x0001 && c <= 0x007f) {
      utflen++
    } else if (c > 0x07ff) {
      utflen += 3
    } else {
      utflen += 2
    }
  }

  if (utflen > 65535) {
    throw new RangeError('encoded string too long: ' + utflen + ' bytes')
  }

  out.writeInt16(utflen)
  if (utflen > 0) {
    out.writeBytes(context.encoder.encode(str))
  }
}

export function readUTF8(buff: ByteBuffer, context: ReadContext) {
  const utflen = buff.readInt16()
  const result = context.decoder.decode(buff.buffer.slice(buff.offset, buff.offset + utflen))
  buff.offset += utflen
  return result
}
