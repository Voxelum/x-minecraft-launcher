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
export async function readPackMeta(
  resourcePack: string | Uint8Array | FileSystem,
): Promise<PackMeta.Pack> {
  const system = await resolveFileSystem(resourcePack)
  try {
    if (!(await system.existsFile('pack.mcmeta'))) {
      throw new Error('Illegal Resourcepack: Cannot find pack.mcmeta!')
    }
    const metadata = JSON.parse(
      (await system.readFile('pack.mcmeta', 'utf-8')).replace(/^\uFEFF/, ''),
    )
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
