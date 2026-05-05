import type { State } from './channel'
import { Coder } from './coders'

interface FieldRecord {
  name: string
  type: Coder<any>
}

export type Side = 'server' | 'client'

export interface PacketRegistryEntry {
  readonly id: number
  readonly name: string
  readonly state: State
  readonly side: Side
  readonly coder: Coder<any>
}

export type FieldType<T> = (type: Coder<T>) => (target: any, key: string) => void
export type PacketType = (
  side: Side,
  id: number,
  state: State,
) => (constructor: (...args: any[]) => any) => void

export const PacketMetadata = Symbol('PacketMetadata')
export const PacketFieldsMetadata = Symbol('PacketFieldsMetadata')

/**
 * Get a packet registry entry for a class
 * @param clazz The class object
 */
export function getPacketRegistryEntry(clazz: new (...args: any) => any): PacketRegistryEntry {
  return clazz.prototype[PacketMetadata]
}

/**
 * Annotate the field type in your packet. Assign a coder for serialization/deserialization.
 * This will generate a list of `FieldType` in your class prototype.
 *
 * @param type The coder to serialize/deserialize the field.
 * @see "coders.ts"
 */
export function Field<T>(type: Coder<T>) {
  return (target: any, key: string) => {
    const container = target
    if (!container[PacketFieldsMetadata]) {
      container[PacketFieldsMetadata] = []
    }
    container[PacketFieldsMetadata].push({ name: key, type })
  }
}
/**
 * Decoarte for you packet class.
 * This will generate a `PacketRegistryEntry` in your class prototype.
 *
 * @param side The side of your packet
 * @param id The id of your packet
 * @param state The state of you packet should be
 */
export function Packet(side: Side, id: number, state: State, name = '') {
  return (constructor: new (...args: any[]) => any) => {
    const container = constructor.prototype
    const fields: FieldRecord[] = container[PacketFieldsMetadata] || []
    container[PacketMetadata] = {
      id,
      name: name || constructor.name,
      side,
      state,
      coder: {
        encode(buffer, value) {
          fields.forEach((cod) => {
            cod.type.encode(buffer, value[cod.name])
          })
        },
        decode(buffer) {
          const value = newCall(constructor)
          fields.forEach((cod) => {
            try {
              value[cod.name] = cod.type.decode(buffer)
            } catch (e) {
              console.error(
                new Error(`Exception during reciving packet [${id}]${constructor.name}`),
              )
              console.error(e)
            }
          })
          return value
        },
      },
    } as PacketRegistryEntry
  }
}

// https://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
function newCall(Cls: any) {
  // tslint:disable-next-line: new-parens
  // eslint-disable-next-line prefer-rest-params
  return new (Function.prototype.bind.apply(Cls, arguments as any))()
}
