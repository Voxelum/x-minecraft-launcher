import { deserializeSync, serializeSync } from '@xmcl/nbt'
import { ByteBuffer } from '@xmcl/bytebuffer'
import '@xmcl/bytebuffer/varint32'
import '@xmcl/bytebuffer/varint64'
import type { PacketRegistry } from './channel'

export interface SlotData {
  blockId: number
  itemCount?: number
  itemDamage?: number
  nbt?: any
}

/**
 * The packet encode/decode algorithm
 */
export interface Coder<T> {
  readonly encode: (buffer: ByteBuffer, data: T, context?: PacketRegistry) => void
  readonly decode: (buffer: ByteBuffer, context?: PacketRegistry) => T
}

export const VarInt: Coder<number> = {
  decode: (buffer, inst) => buffer.readVarint32(),
  encode: (buffer, inst) => {
    buffer.writeVarint32(inst)
  },
}

export const Int: Coder<number> = {
  decode: (buffer, inst) => buffer.readInt(),
  encode: (buffer, inst) => {
    buffer.writeInt(inst)
  },
}

export const Byte: Coder<number> = {
  decode: (buffer, inst) => buffer.readByte(),
  encode: (buffer, inst) => {
    buffer.writeByte(inst)
  },
}

export const UByte: Coder<number> = {
  decode: (buffer, inst) => buffer.readUint8(),
  encode: (buffer, inst) => {
    buffer.writeUint8(inst)
  },
}

export const Bool: Coder<boolean> = {
  decode: (buffer, inst) => buffer.readByte() === 1,
  encode: (buffer, inst) => {
    buffer.writeByte(inst ? 1 : 0)
  },
}

export const Float: Coder<number> = {
  decode: (buffer, inst) => buffer.readFloat(),
  encode: (buffer, inst) => {
    buffer.writeFloat(inst)
  },
}

export const Double: Coder<number> = {
  decode: (buffer, inst) => buffer.readDouble(),
  encode: (buffer, inst) => {
    buffer.writeDouble(inst)
  },
}

export const UUID: Coder<string> = {
  decode: (buffer, inst) => {
    const makeDigit = (hex: string, digit: number) => {
      if (hex.length < digit) {
        let d = ''
        for (let i = 0; i < digit - hex.length; i += 1) {
          d += '0'
        }
        return `${d}${hex}`
      }
      return hex
    }
    const hi = buffer.readUint64()
    const lo = buffer.readUint64()

    let a = makeDigit(Number(hi >> 32n).toString(16), 8)
    const b = makeDigit(((hi >> 16n) & 0xffffn).toString(16), 4)
    const c = makeDigit((hi & 0xffffn).toString(16), 4)
    const d = makeDigit(((lo >> 48n) & 0xffffn).toString(16), 4)
    const e = makeDigit((lo & 0xffffffffffffn).toString(16), 12)

    if (a.length === 16) {
      a = a.substring(8, 16)
    }

    return `${a}-${b}-${c}-${d}-${e}`
  },
  encode: (buffer, inst) => {
    const components = inst.split('-')
    if (components.length !== 5) {
      throw new Error('Invalid UUID')
    }
    let hi = BigInt(`0x${components[0]}`)
    hi = hi << 16n
    hi = hi | BigInt(`0x${components[1]}`)
    hi = hi << 16n
    hi = hi | BigInt(`0x${components[2]}`)

    let lo = BigInt(`0x${components[3]}`)
    lo = lo << 48n
    lo = lo | BigInt(`0x${components[4]}`)

    buffer.writeUint64(hi)
    buffer.writeUint64(lo)
  },
}

export const Short: Coder<number> = {
  decode: (buffer, inst) => buffer.readShort(),
  encode: (buffer, inst) => {
    buffer.writeShort(inst)
  },
}

export const UShort: Coder<number> = {
  decode: (buffer, inst) => buffer.readUint16(),
  encode: (buffer, inst) => {
    buffer.writeUint16(inst)
  },
}

export const Long: Coder<bigint> = {
  decode: (buffer, inst) => buffer.readLong(),
  encode: (buffer, inst) => {
    buffer.writeInt64(inst)
  },
}

export const VarLong: Coder<bigint> = {
  decode: (buffer, inst) => buffer.readVarint64(),
  encode: (buffer, inst) => {
    buffer.writeVarint64(inst)
  },
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const String: Coder<string> = {
  decode: (buffer) => {
    const length = buffer.readVarint32()
    return Buffer.from(buffer.readBytes(length).toBuffer()).toString('utf-8')
  },
  encode: (buffer, inst) => {
    const byte = Buffer.from(inst)
    buffer.writeVarint32(byte.byteLength)
    buffer.writeBytes(Buffer.from(inst))
  },
}

export const Json: Coder<any> = {
  decode: (buffer, inst) => {
    return JSON.parse(String.decode(buffer, inst))
  },
  encode: (buffer, inst, ctx) => {
    String.encode(buffer, JSON.stringify(inst), ctx)
  },
}

export const Slot: Coder<SlotData> = {
  decode: (buffer, ctx) => {
    const blockId = Short.decode(buffer, ctx)
    if (blockId === -1) {
      return { blockId }
    }
    const itemCount = Byte.decode(buffer) || undefined
    const itemDamage = Short.decode(buffer) || undefined
    if (Byte.decode(buffer, ctx) === 0) {
      return {
        blockId,
        itemCount,
        itemDamage,
      }
    }
    return {
      blockId,
      itemCount,
      itemDamage,
      nbt: deserializeSync(Buffer.from(buffer.buffer)),
    }
  },
  encode: (buffer, inst) => {
    Short.encode(buffer, inst.blockId)
    Byte.encode(buffer, inst.itemCount || 0)
    Byte.encode(buffer, inst.itemDamage || 0)
    if (inst.nbt) {
      Byte.encode(buffer, 1)
      buffer.writeBytes(serializeSync(inst.nbt))
    } else {
      Byte.encode(buffer, 0)
    }
  },
}

export const ByteArray: Coder<Int8Array> = {
  decode: (buffer, inst) => {
    const len = buffer.readVarint32()
    const arr = new Int8Array(len)
    for (let i = 0; i < len; i += 1) {
      arr[i] = buffer.readByte()
    }
    return arr
  },
  encode: (buffer, inst) => {
    const len = inst.length
    buffer.writeVarint32(len)
    for (let i = 0; i < len; i += 1) {
      buffer.writeByte(inst[i])
    }
  },
}
