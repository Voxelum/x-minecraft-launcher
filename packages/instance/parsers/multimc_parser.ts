import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { RuntimeVersions } from '../instance'
import { InstanceFile } from '../files'
import { getInstanceFiles } from '../files_discovery'
import { existsSync, readFile } from 'fs-extra'
import { CreateInstanceOptions } from '../create'

/**
 * MultiMC instance configuration interface
 */
export interface MultiMCConfig {
  JavaPath: string
  name: string
  JvmArgs: string
  MaxMemAlloc: string
  MinMemAlloc: string
  ShowConsole: string
  lastTimePlayed: string
  totalTimePlayed: string
  notes: string
  MinecraftWinWidth: string
  MinecraftWinHeight: string
  JoinServerOnLaunch: string
  JoinServerOnLaunchAddress: string
}

/**
 * MultiMC pack manifest (mmc-pack.json)
 */
export interface MultiMCManifest {
  formatVersion: number
  components: MultiMCManifestComponent[]
}

export interface MultiMCManifestComponent {
  cachedName: string
  cachedVersion: string
  cachedRequires: Array<{
    equals?: string
    uid: string
  }>
  important?: boolean
  uid: string
  version: string
}

/**
 * Detect MultiMC root directory
 */
export function detectMMCRoot(path: string): string {
  const original = path
  let instancesPath = join(path, 'instances')

  if (existsSync(instancesPath)) {
    return path
  }
  path = dirname(path)
  instancesPath = join(path, 'instances')

  if (existsSync(instancesPath)) {
    return path
  }

  path = dirname(path)
  instancesPath = join(path, 'instances')

  if (!existsSync(instancesPath)) {
    // Not a MultiMC root... but return and throw error in later code path
    return original
  }

  return path
}

/**
 * Parse MultiMC instance configuration
 */
export async function parseMultiMCInstance(path: string): Promise<CreateInstanceOptions> {
  const instanceCFGText = await readFile(join(path, 'instance.cfg'), 'utf-8')
  const instanceCFG = instanceCFGText.split('\n').reduce(
    (acc, line) => {
      if (!line || line.trim().length === 0) return acc
      const [key, value] = line.split('=')
      acc[key] = value
      return acc
    },
    {} as Record<string, string>,
  ) as any as MultiMCConfig

  const instancePack = JSON.parse(
    await readFile(join(path, 'mmc-pack.json'), 'utf-8'),
  ) as MultiMCManifest

  const instanceOptions: CreateInstanceOptions = {
    name: instanceCFG.name,
  }

  if (instanceCFG.JavaPath) {
    instanceOptions.java = instanceCFG.JavaPath
  }

  if (instanceCFG.JoinServerOnLaunch && instanceCFG.JoinServerOnLaunchAddress) {
    const [host, port] = instanceCFG.JoinServerOnLaunchAddress.split(':')
    instanceOptions.server = {
      host,
      port: port && !isNaN(parseInt(port)) ? parseInt(port) : undefined,
    }
  }

  if (instanceCFG.MinMemAlloc) {
    instanceOptions.minMemory = parseInt(instanceCFG.MinMemAlloc)
  }
  if (instanceCFG.MaxMemAlloc) {
    instanceOptions.maxMemory = parseInt(instanceCFG.MaxMemAlloc)
  }
  if (instanceCFG.ShowConsole) {
    instanceOptions.showLog = instanceCFG.ShowConsole === 'true'
  }
  if (instanceCFG.notes) {
    instanceOptions.description = instanceCFG.notes
  }
  if (instanceCFG.JvmArgs) {
    instanceOptions.vmOptions = instanceCFG.JvmArgs.split(' ')
  }
  if (instanceCFG.lastTimePlayed) {
    instanceOptions.lastPlayedDate = parseInt(instanceCFG.lastTimePlayed)
  }
  if (instanceCFG.totalTimePlayed) {
    instanceOptions.playtime = parseInt(instanceCFG.totalTimePlayed)
  }
  if (instanceCFG.MinecraftWinWidth && instanceCFG.MinecraftWinHeight) {
    instanceOptions.resolution = {
      width: parseInt(instanceCFG.MinecraftWinWidth),
      height: parseInt(instanceCFG.MinecraftWinHeight),
      fullscreen: false,
    }
  }

  if (instancePack.formatVersion === 1) {
    const minecraft = instancePack.components.find((c) => c.uid === 'net.minecraft')?.version ?? ''
    const forge = instancePack.components.find((c) => c.uid === 'net.minecraftforge')?.version ?? ''
    const optifine =
      instancePack.components.find((c) => c.uid === 'optifine.Optifine')?.version ?? ''
    const fabricLoader =
      instancePack.components.find((c) => c.uid === 'net.fabricmc.fabric-loader')?.version ?? ''
    const quiltLoader =
      instancePack.components.find((c) => c.uid === 'org.quiltmc.quilt-loader')?.version ?? ''
    instanceOptions.runtime = {
      minecraft,
      forge,
      optifine,
      fabricLoader,
      quiltLoader,
    }
  }

  instanceOptions.resourcepacks = true
  instanceOptions.shaderpacks = true

  return instanceOptions
}

/**
 * Parse MultiMC instance files
 */
export async function parseMultiMCInstanceFiles(instancePath: string): Promise<InstanceFile[]> {
  const files = await getInstanceFiles(instancePath)

  for (const [f] of files) {
    f.downloads = [pathToFileURL(join(instancePath, f.path)).toString()]
  }

  return files.map(([file]) => file)
}
