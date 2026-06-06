/**
 * The resource pack module to read Minecraft resource pack just like Minecraft in-game.
 *
 * You can open the ResourcePack by {@link ResourcePack.open} and get resource by {@link ResourcePack.get}.
 *
 * Or you can just load resource pack metadata by {@link readPackMetaAndIcon}.
 *
 * @packageDocumentation
 * @module @xmcl/resourcepack
 */

import { FileSystem, resolveFileSystem } from '@xmcl/system'
import { PackMeta } from './format'

export * from './resourceManager'
export * from './resourcePack'
export * from './modelLoader'
export * from './format'

/**
 * Read the resource pack metadata from zip file or directory.
 *
 * If you have already read the data of the zip file, you can pass it as the second parameter. The second parameter will be ignored on reading directory.
 *
 * @param resourcePack The absolute path of the resource pack file, or a buffer, or a opened resource pack.
 */
/**
 * Re-escape unescaped control characters inside JSON string literals so a
 * strict {@link JSON.parse} will accept the input. The Minecraft client
 * uses Gson's lenient mode which tolerates raw newlines / tabs inside
 * string values (a common author mistake — e.g. typing a real newline in
 * a `description` field to visually wrap the text). We mirror that
 * tolerance only as a fallback, so legitimately malformed JSON still
 * fails on the strict pass.
 */
function leniencyRescueJson(src: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (escape) { out += c; escape = false; continue }
    if (c === '\\') { out += c; escape = true; continue }
    if (c === '"') { inString = !inString; out += c; continue }
    if (inString) {
      const code = c.charCodeAt(0)
      if (code === 0x0a) { out += '\\n'; continue }
      if (code === 0x0d) { out += '\\r'; continue }
      if (code === 0x09) { out += '\\t'; continue }
      if (code < 0x20) { out += '\\u' + code.toString(16).padStart(4, '0'); continue }
    }
    out += c
  }
  return out
}

export async function readPackMeta(
  resourcePack: string | Uint8Array | FileSystem,
): Promise<PackMeta.Pack> {
  const system = await resolveFileSystem(resourcePack)
  try {
    if (!(await system.existsFile('pack.mcmeta'))) {
      throw new Error('Illegal Resourcepack: Cannot find pack.mcmeta!')
    }
    const raw = (await system.readFile('pack.mcmeta', 'utf-8')).replace(/^\uFEFF/, '')
    let metadata: any
    try {
      metadata = JSON.parse(raw)
    } catch (strictErr) {
      try {
        metadata = JSON.parse(leniencyRescueJson(raw))
      } catch {
        throw strictErr
      }
    }
    if (!metadata.pack) {
      throw new Error("Illegal Resourcepack: pack.mcmeta doesn't contain the pack metadata!")
    }
    return metadata.pack
  } finally {
    if (system !== resourcePack) system.close()
  }
}

/**
 * Read the resource pack icon png binary.
 * @param resourcePack The absolute path of the resource pack file, or a buffer, or a opened resource pack.
 */
export async function readIcon(
  resourcePack: string | Uint8Array | FileSystem,
): Promise<Uint8Array> {
  const system = await resolveFileSystem(resourcePack)
  try {
    return system.readFile('pack.png')
  } finally {
    if (system !== resourcePack) system.close()
  }
}

/**
 * Read both metadata and icon
 *
 * @see {@link readIcon}
 * @see {@link readPackMeta}
 */
export async function readPackMetaAndIcon(resourcePack: string | Uint8Array | FileSystem) {
  const system = await resolveFileSystem(resourcePack)

  try {
    return {
      metadata: await readPackMeta(system),
      icon: await readIcon(system).catch(() => undefined),
    }
  } finally {
    if (system !== resourcePack) system.close()
  }
}
