import { openFileSystem } from '@xmcl/system'
import { writeJSON } from 'fs-extra'
import { basename, extname, join, relative } from 'path'
import { RESOURCE_FILE_VERSION } from '../constant'
import { forgeModParser } from '../entities/resourceParsers/forgeMod'
import { Logger } from './log'

/**
 * The helper function to fix old resource schema
 */
export async function fixResourceSchema({ log, warn }: Logger, filePath: string, schema: any, dataRoot: string) {
  let dirty = false
  if ('path' in schema && !schema.fileName) {
    const relativePath = relative(dataRoot, (schema as any).path)
    const ext = extname(relativePath)
    schema.fileName = basename(relativePath, ext)
    log(`Fix location ${schema.path} ${schema.fileName}`)
    dirty = true
  }
  if ('source' in (schema as any)) {
    const source = (schema as any).source
    schema.uri = source.uri
    schema.curseforge = source.uri
    schema.github = source.github
    schema.date = source.date
    dirty = true
  }

  if (schema.type === 'forge' && RESOURCE_FILE_VERSION < 1) {
    // fix forge metadata
    log(`Fix ${filePath} file version: ${schema.version} -> ${RESOURCE_FILE_VERSION}`)
    const fs = await openFileSystem(join(dataRoot, schema.location + schema.ext))
    const data = await forgeModParser.parseMetadata(fs)
    fs.close()
    schema.metadata = data
    schema.version = RESOURCE_FILE_VERSION
    log(`Reparsed ${filePath} as forge mod`)
    await writeJSON(filePath, schema)
    dirty = true
  }

  if (RESOURCE_FILE_VERSION < 2 || !schema.fileName) {
    if (typeof schema.location === 'string') {
      schema.fileName = basename(schema.location)
      schema.version = RESOURCE_FILE_VERSION
    }
  }

  if (dirty) {
    await writeJSON(filePath, schema)
  }
}
