import { Schema } from '@xmcl/runtime-api'
import { writeFile, readFile } from 'atomically'
import { ensureFile } from 'fs-extra/esm'
import { copyFile } from 'fs/promises'
import { missing } from './fs'
import { Logger } from './log'
import { SafeJsonSerializer } from './serialize'

export interface SafeFile<T> {
  write(data: T): Promise<void>
  read(): Promise<T>
}

/**
 * Create a mapped a json file to disk with type safe.
 * @param path The path of the file
 * @param schema The schema of the json
 * @param logger The logger
 * @returns The mapped file
 */
export function createSafeFile<T>(path: string, schema: Schema<T>, logger: Logger, legacyPaths: string[] = [], defaultVal?: () => Promise<T>) {
  const serializer = new SafeJsonSerializer(schema, logger)
  return {
    async write(data: T) {
      await ensureFile(path)
      await writeFile(path, await serializer.serialize(data))
    },
    async read(): Promise<T> {
      let isMissing = await missing(path)
      if (isMissing) {
        for (const p of legacyPaths) {
          try {
            await copyFile(p, path)
            isMissing = false
            break
          } catch {
          }
        }
      }
      if (isMissing && defaultVal) {
        return await defaultVal()
      }
      return await serializer.deserialize(await readFile(path).catch(e => Buffer.from('')))
    },
  }
}

/**
 * Create a safe io device to write json file with type safe
 * @param schema The schema of the json
 * @param logger The logger
 * @returns The mapped io device
 */
export function createSafeIO<T>(schema: Schema<T>, logger?: Logger) {
  const serializer = new SafeJsonSerializer(schema, logger)
  return {
    async write(path: string, data: T) {
      await ensureFile(path)
      await writeFile(path, await serializer.serialize(data))
    },
    async read(path: string): Promise<T> {
      return await serializer.deserialize(await readFile(path).catch(e => Buffer.from('')))
    },
  }
}
