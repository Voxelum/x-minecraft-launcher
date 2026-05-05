import { readFile } from 'fs-extra'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { RuntimeVersions } from '../instance'
import { InstanceFile } from '../files'
import { getInstanceFiles } from '../files_discovery'
import { Logger } from '../internal_type'
import { CreateInstanceOptions } from '../create'

/**
 * Vanilla launcher profile
 */
export interface VanillaProfile {
  name: string
  type: string
  created: string
  lastUsed: string
  icon: string
  lastVersionId: string
  gameDir?: string
  javaArgs?: string
  javaDir?: string
  resolution?: {
    width: number
    height: number
  }
}

/**
 * Vanilla launcher_profiles.json
 */
export interface VanillaProfiles {
  profiles: Record<string, VanillaProfile>
  settings: {
    crashAssistance: boolean
    enableAdvanced: boolean
    enableAnalytics: boolean
    enableHistorical: boolean
    enableReleases: boolean
    enableSnapshots: boolean
    keepLauncherOpen: boolean
    profileSorting: string
    showGameLog: boolean
    showMenu: boolean
    soundOn: boolean
  }
  version: number
}

/**
 * Parse vanilla Minecraft instances from launcher_profiles.json
 */
export async function parseVanillaInstance(
  minecraftPath: string,
): Promise<Array<{ path: string; options: CreateInstanceOptions }>> {
  try {
    const profilesPath = join(minecraftPath, 'launcher_profiles.json')
    const data = await readFile(profilesPath, 'utf-8')
    const profiles = JSON.parse(data) as VanillaProfiles

    const instances: Array<{ path: string; options: CreateInstanceOptions }> = []

    for (const [id, profile] of Object.entries(profiles.profiles)) {
      const instancePath = profile.gameDir || minecraftPath

      const options: CreateInstanceOptions = {
        name: profile.name,
        runtime: {
          minecraft: profile.lastVersionId,
        },
        resourcepacks: true,
        shaderpacks: true,
      }

      if (profile.javaDir) {
        options.java = profile.javaDir
      }

      if (profile.javaArgs) {
        options.vmOptions = profile.javaArgs.split(' ')
      }

      if (profile.resolution) {
        options.resolution = {
          width: profile.resolution.width,
          height: profile.resolution.height,
          fullscreen: false,
        }
      }

      instances.push({
        path: instancePath,
        options,
      })
    }

    return instances
  } catch (error) {
    // If launcher_profiles.json doesn't exist or is invalid, return empty array
    return []
  }
}

/**
 * Parse vanilla instance files
 */
export async function parseVanillaInstanceFiles(
  instancePath: string,
  logger?: Logger,
): Promise<InstanceFile[]> {
  const files = await getInstanceFiles(instancePath, logger, (f) => {
    if (f === 'launcher_profiles.json') return true
    if (f === 'launcher_settings.json') return true
    if (f === 'usercache.json') return true
    if (f === 'usernamecache.json') return true
    return false
  })

  for (const [file] of files) {
    file.downloads = [pathToFileURL(join(instancePath, file.path)).toString()]
  }

  return files.map(([file]) => file)
}
