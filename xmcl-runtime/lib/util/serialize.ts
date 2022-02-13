import { Schema } from '@xmcl/runtime-api'
import Ajv from 'ajv'
import { Logger } from './log'

export interface Serializer<D, T> {
  serialize(value: T): D | Promise<D>
  deserialize(data: D): T | Promise<T>
}

const AJV_INSTANCE = new Ajv({ useDefaults: true, removeAdditional: true })

/**
 * The type safe serializer between object to json string
 */
export class SafeJsonSerializer<T> implements Serializer<Buffer, T> {
  private validation: ReturnType<typeof AJV_INSTANCE.compile>

  constructor(schema: Schema<T>, private logger?: Logger) {
    this.validation = AJV_INSTANCE.compile(schema)
  }

  async serialize(data: T) {
    const deepCopy = JSON.parse(JSON.stringify(data))
    const validation = this.validation
    const valid = validation(deepCopy)
    if (!valid) {
      if (validation.errors) {
        this.logger?.error(`Error to serialize the datatype ${typeof data}:\n`)
        this.logger?.log(JSON.stringify(validation.errors))
      }
    }
    return Buffer.from(JSON.stringify(deepCopy), 'utf-8')
  }

  async deserialize(b: Buffer) {
    const originalString = b.toString('utf-8')
    let object
    try {
      object = JSON.parse(originalString)
    } catch (e) {
      object = {}
    }
    if (object) {
      const validation = this.validation
      const valid = validation(object)
      if (!valid) {
        this.logger?.warn('Try to remove those invalid keys. This might cause problem.')
        if (validation.errors) {
          this.logger?.warn(JSON.stringify(validation.errors))
        }
      }
    }
    return object
  }
}
