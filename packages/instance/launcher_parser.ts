import { isSystemError } from '@xmcl/utils'
import { existsSync, readdir } from 'fs-extra'
import { join } from 'path'
import type { InstanceType, ThirdPartyLauncherManifest } from './modpack'
import { parseCurseforgeInstance, parseCurseforgeInstanceFiles } from './parsers/curseforge_parser'
import { parseModrinthInstance, parseModrinthInstanceFiles } from './parsers/modrinth_parser'
import {
  detectMMCRoot,
  parseMultiMCInstance,
  parseMultiMCInstanceFiles,
} from './parsers/multimc_parser'
import { parseVanillaInstance, parseVanillaInstanceFiles } from './parsers/vanilla_parser'

/**
 * Check if a path is a MultiMC instance
 */
function isMultiMCInstance(path: string): boolean {
  return existsSync(join(path, 'instance.cfg')) && existsSync(join(path, 'mmc-pack.json'))
}

/**
 * Check if a path is a Modrinth instance
 */
function isModrinthInstance(path: string): boolean {
  return existsSync(join(path, 'profile.json'))
}

/**
 * Check if a path is a CurseForge instance
 */
function isCurseforgeInstance(path: string): boolean {
  return existsSync(join(path, 'minecraftinstance.json'))
}

/**
 * Check if a path is a Vanilla Minecraft installation
 */
function isVanillaMinecraft(path: string): boolean {
  return existsSync(join(path, 'launcher_profiles.json'))
}

/**
 * Auto-detect the launcher type from a path
 */
export function detectLauncherType(path: string): InstanceType | null {
  if (
    isMultiMCInstance(path) ||
    (detectMMCRoot(path) !== path && existsSync(join(detectMMCRoot(path), 'instances')))
  ) {
    return 'mmc'
  }

  if (isModrinthInstance(path) || existsSync(join(path, 'profiles'))) {
    return 'modrinth'
  }

  if (isCurseforgeInstance(path) || existsSync(join(path, 'Instances'))) {
    return 'curseforge'
  }

  if (isVanillaMinecraft(path)) {
    return 'vanilla'
  }

  return null
}

/**
 * Parse launcher data to get instances and shared folders
 */
export async function parseLauncherData(
  path: string,
  type?: InstanceType,
): Promise<ThirdPartyLauncherManifest> {
  const actualType = type || detectLauncherType(path)

  if (!actualType) {
    throw new Error(`Cannot detect launcher type for path: ${path}`)
  }

  try {
    switch (actualType) {
      case 'mmc': {
        const rootPath = detectMMCRoot(path)
        const instancesPath = join(rootPath, 'instances')
        const instances = await readdir(instancesPath)

        const manifests = await Promise.allSettled(
          instances.map(async (instance) => {
            const instancePath = join(instancesPath, instance)
            const options = await parseMultiMCInstance(instancePath)
            return {
              options,
              path: instancePath,
            }
          }),
        )

        return {
          folder: {
            assets: join(rootPath, 'assets'),
            libraries: join(rootPath, 'libraries'),
            versions: '',
            jre: undefined,
          },
          instances: manifests
            .filter((m): m is PromiseFulfilledResult<any> => m.status === 'fulfilled')
            .map((m) => m.value),
        }
      }

      case 'modrinth': {
        const instancesPath = join(path, 'profiles')
        const instances = await readdir(instancesPath)

        const manifests = await Promise.allSettled(
          instances.map(async (instance) => {
            const instancePath = join(instancesPath, instance)
            const options = await parseModrinthInstance(instancePath)
            return {
              options,
              path: instancePath,
            }
          }),
        )

        const assets = join(path, 'meta', 'assets')
        const libraries = join(path, 'meta', 'libraries')
        const versions = join(path, 'meta', 'versions')
        const jre = join(path, 'meta', 'java_versions')

        return {
          folder: {
            assets: existsSync(assets) ? assets : '',
            libraries: existsSync(libraries) ? libraries : '',
            versions: existsSync(versions) ? versions : '',
            jre: existsSync(jre) ? jre : undefined,
          },
          instances: manifests
            .filter((m): m is PromiseFulfilledResult<any> => m.status === 'fulfilled')
            .map((m) => m.value),
        }
      }

      case 'curseforge': {
        const instancesPath = join(path, 'Instances')
        const minecraftDataPath = join(path, 'Install')

        const instances = await readdir(instancesPath)
        const manifests = await Promise.allSettled(
          instances.map(async (instance) => {
            const instancePath = join(instancesPath, instance)
            const options = await parseCurseforgeInstance(instancePath)
            return {
              options,
              path: instancePath,
            }
          }),
        )

        const versionDir = join(minecraftDataPath, 'versions')
        const libDir = join(minecraftDataPath, 'libraries')
        const assetsDir = join(minecraftDataPath, 'assets')

        return {
          folder: {
            versions: existsSync(versionDir) ? versionDir : '',
            libraries: existsSync(libDir) ? libDir : '',
            assets: existsSync(assetsDir) ? assetsDir : '',
            jre: undefined,
          },
          instances: manifests
            .filter((m): m is PromiseFulfilledResult<any> => m.status === 'fulfilled')
            .map((m) => m.value),
        }
      }

      case 'vanilla': {
        const vanillaInstances = await parseVanillaInstance(path)

        const assets = join(path, 'assets')
        const libraries = join(path, 'libraries')
        const versions = join(path, 'versions')
        const jre = join(path, 'jre')

        return {
          folder: {
            assets: existsSync(assets) ? assets : '',
            libraries: existsSync(libraries) ? libraries : '',
            versions: existsSync(versions) ? versions : '',
            jre: existsSync(jre) ? jre : undefined,
          },
          instances: vanillaInstances,
        }
      }

      default:
        throw new Error(`Unsupported launcher type: ${actualType}`)
    }
  } catch (error) {
    if (isSystemError(error) && error.code === 'ENOENT') {
      throw new Error(`Bad instance path: ${path}`, { cause: error })
    }
    throw error
  }
}

/**
 * Parse instance files from a specific instance path
 */
export async function parseInstanceFiles(path: string, type?: InstanceType) {
  const actualType = type || detectLauncherType(path)

  if (!actualType) {
    throw new Error(`Cannot detect launcher type for path: ${path}`)
  }

  switch (actualType) {
    case 'mmc':
      return parseMultiMCInstanceFiles(path)

    case 'modrinth':
      return parseModrinthInstanceFiles(path)

    case 'curseforge':
      return parseCurseforgeInstanceFiles(path)

    case 'vanilla':
      return parseVanillaInstanceFiles(path)

    default:
      throw new Error(`Unsupported launcher type: ${actualType}`)
  }
}
