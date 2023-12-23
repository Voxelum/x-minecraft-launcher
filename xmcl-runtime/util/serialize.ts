import { Schema } from '@xmcl/runtime-api'
import Ajv from 'ajv'
import { Logger } from '~/logger'
import { AnyError } from './error'

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
        this.logger?.error(new Error(`Error to serialize the datatype ${typeof data}:\n` + JSON.stringify(validation.errors) + '\n' + JSON.stringify(data)))
      }
    }
    return Buffer.from(JSON.stringify(deepCopy, undefined, 2), 'utf-8')
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

      let retry = false
      let lastErrorPath = ''
      let retryCount = 0
      let totalRetryCount = 0
      const MAX_RETRY = 10000
      do {
        retry = false
        totalRetryCount++
        const valid = validation(object)
        if (valid) break
        if (!validation.errors) break
        try {
          const err = validation.errors[0]
          if (err.instancePath === lastErrorPath) {
            // The error persists and cannot be fixed
            if (retryCount++ > 3) {
              break
            }
          } else {
            retryCount = 0
          }
          if (err.instancePath === '' && err.keyword === 'type') {
            // root failed
            if (err.params.type === 'array') {
              object = []
            } else if (err.params.type === 'object') {
              object = {}
            }
            lastErrorPath = err.instancePath
            retry = true
          } else if (err.keyword === 'type' || err.keyword === 'required') {
            // just delete the value if this key is invalid
            const instancePath = err.instancePath
            const keyChain = instancePath.split('/').slice(1)
            const parents = keyChain.slice(0, keyChain.length - 1)
            const key = keyChain[keyChain.length - 1]

            let current = object
            for (const val of parents) {
              current = current[val]
            }
            if (current instanceof Array && Number.isInteger(Number(key))) {
              current.splice(Number.parseInt(key, 10), 1)
            } else {
              delete current[key]
            }
            lastErrorPath = instancePath
            retry = true
          }
        } catch (e) {
          this.logger?.error(new AnyError('DeserializeJsonError', originalString, { cause: e }))
        }
      } while (retry && totalRetryCount < MAX_RETRY)
      if (validation.errors) {
        this.logger?.error(new AnyError('DeserializeJsonError', 'Cannot fix the type error. This might cause problems!' + validation.errors ? ` ${JSON.stringify(validation.errors)}` : ''))
      }
    }
    return object
  }
}
