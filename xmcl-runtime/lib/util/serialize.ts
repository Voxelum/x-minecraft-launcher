import { Schema } from '@xmcl/runtime-api'
import { readInfo, ServerInfo, writeInfo } from '@xmcl/server-info'
import { createContext, runInContext } from 'vm'
import Ajv from 'ajv'
import { Logger } from './log'

export interface Serializer<D, T> {
  serialize(value: T): D | Promise<D>
  deserialize(data: D): T | Promise<T>
}

export function pipe<A, B, C>(serialzerIn: Serializer<A, B>, serialzerOut: Serializer<B, C>): Serializer<A, C> {
  return {
    async serialize(val) {
      return serialzerIn.serialize(await serialzerOut.serialize(val))
    },
    async deserialize(data) {
      return serialzerOut.deserialize(await serialzerIn.deserialize(data))
    },
  }
}

export class BufferJsonSerializer<T> implements Serializer<Buffer, T> {
  constructor(readonly schema: Schema<T>, private logger?: Logger) { }

  serialize(data: T) {
    const deepCopy = JSON.parse(JSON.stringify(data))
    const schemaObject = this.schema
    const ajv = new Ajv({ useDefaults: true, removeAdditional: true })
    const validation = ajv.compile(schemaObject)
    const valid = validation(deepCopy)
    if (!valid) {
      const context = createContext({ object: deepCopy })
      if (validation.errors) {
        this.logger?.error(`Error to serialize the datatype ${typeof data}:\n`)
        console.log(JSON.stringify(validation.errors))
        // let message = `Error to serialize the datatype ${typeof data}:\n`
        // validation.errors.forEach(e => {
        //   message += `- ${e.keyword} error @[${e.dataPath}:${e.schemaPath}]: ${e.message}\n`
        // })
        // const cmd = validation.errors.map(e => `delete object${e.dataPath};`)
        // console.log(message)
        // console.log(cmd.join('\n'))
        // runInContext(cmd.join('\n'), context)
      }
    }
    return Buffer.from(JSON.stringify(deepCopy), 'utf-8')
  }

  deserialize(b: Buffer) {
    const originalString = b.toString('utf-8')
    let object
    try {
      object = JSON.parse(originalString)
    } catch (e) {
      object = {}
    }
    if (object) {
      const ajv = new Ajv({ useDefaults: true, removeAdditional: true })
      const validation = ajv.compile(this.schema)
      const valid = validation(object)
      if (!valid) {
        console.warn('Try to remove those invalid keys. This might cause problem.')
        const context = createContext({ object })
        if (validation.errors) {
          console.log(JSON.stringify(validation.errors))
          // console.warn(`Found invalid config file on ${path}.`)
          // validation.errors.forEach(e => console.warn(e))
          // const cmd = validation.errors.filter(e => e.dataPath).map(e => `delete object${e.dataPath};`)
          // if (cmd.length !== 0) {
          //   console.log(cmd.join('\n'))
          //   runInContext(cmd.join('\n'), context)
          // }
        }
      }
    }
    return object
  }
}
