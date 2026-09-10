import { basename, dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { InstanceFile } from '../files'
import { getInstanceFiles } from '../files_discovery'
import { existsSync, readFile, readdir } from 'fs-extra'
import { CreateInstanceOptions } from '../create'
import { getInstanceConfigFromMmcModpack, type MMCComponentPatch, type MMCModpackManifest } from '../modpack'

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
  /**
   * Whether per-instance commands override the launcher-global commands.
   * Only when this is `"true"` does MultiMC actually run the per-instance
   * `PreLaunchCommand` / `WrapperCommand` / `PostExitCommand`. See gh #1386.
   */
  OverrideCommands: string
  /** Per-instance command run before launching Minecraft */
  PreLaunchCommand: string
  /** Per-instance command that wraps (prepends) the JVM invocation */
  WrapperCommand: string
  /** Per-instance command run after the game exits (no xmcl equivalent yet) */
  PostExitCommand: string
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
 * Accept either the launcher instance folder or its Minecraft data directory.
 */
export function getMultiMCInstancePath(path: string): string {
  if (['minecraft', '.minecraft'].includes(basename(path)) && existsSync(join(dirname(path), 'instance.cfg'))) {
    return dirname(path)
  }
  return path
}

export function isMultiMCInstance(path: string): boolean {
  const root = getMultiMCInstancePath(path)
  // Keep incomplete instances visible to the parser so missing metadata is an
  // import error, not a silently skipped instance or an unflattened game folder.
  return existsSync(join(root, 'instance.cfg')) || existsSync(join(root, 'mmc-pack.json'))
}

export function getMultiMCGameDirectory(path: string): string {
  const root = getMultiMCInstancePath(path)
  return existsSync(join(root, '.minecraft')) ? join(root, '.minecraft') : join(root, 'minecraft')
}

export async function readMultiMCManifest(path: string): Promise<MMCModpackManifest> {
  path = getMultiMCInstancePath(path)
  const instanceCFGText = await readFile(join(path, 'instance.cfg'), 'utf-8')
  const instanceCFG = instanceCFGText.split(/\r?\n/).reduce(
    (acc, line) => {
      if (!line || line.trim().length === 0 || line.startsWith('#') || line.startsWith('[')) return acc
      const eq = line.indexOf('=')
      if (eq < 0) return acc
      const key = line.substring(0, eq).trim()
      // Values may legitimately contain '=' (e.g. wrapper command env vars),
      // so we only split on the first '='.
      acc[key] = line.substring(eq + 1)
      return acc
    },
    {} as Record<string, string>,
  )

  const json = JSON.parse(await readFile(join(path, 'mmc-pack.json'), 'utf-8'))
  if (json?.formatVersion !== 1 || !Array.isArray(json.components) ||
    !json.components.every((c: any) => c && typeof c.uid === 'string') ||
    !json.components.some((c: any) => c?.uid === 'net.minecraft')) {
    throw new Error(`Invalid MultiMC manifest: ${path}`)
  }

  const patches: Record<string, MMCComponentPatch> = Object.create(null)
  const patchFiles = await readdir(join(path, 'patches')).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  for (const file of patchFiles.sort()) {
    if (!file.endsWith('.json')) continue
    const patch = JSON.parse(await readFile(join(path, 'patches', file), 'utf-8'))
    if (!patch || typeof patch.uid !== 'string' || !patch.uid) {
      throw new Error(`Invalid MultiMC patch: ${join(path, 'patches', file)}`)
    }
    patches[patch.uid] = patch
  }

  return {
    json,
    cfg: { name: '', notes: '', ...instanceCFG },
    patches: Object.keys(patches).length ? patches : undefined,
  }
}

/**
 * Parse directory-only settings on top of the shared ZIP/directory patch merger.
 */
export async function parseMultiMCInstance(
  path: string,
  manifest?: MMCModpackManifest,
): Promise<CreateInstanceOptions> {
  manifest ??= await readMultiMCManifest(path)
  const instanceCFG = manifest.cfg
  const instanceOptions: CreateInstanceOptions = getInstanceConfigFromMmcModpack(manifest)

  if (instanceCFG.JavaPath) {
    instanceOptions.java = instanceCFG.JavaPath
  }

  if (instanceCFG.JoinServerOnLaunch === 'true' && instanceCFG.JoinServerOnLaunchAddress) {
    const [host, port] = instanceCFG.JoinServerOnLaunchAddress.split(':')
    instanceOptions.server = {
      host,
      port: port && !isNaN(parseInt(port)) ? parseInt(port) : undefined,
    }
  }

  if (instanceCFG.ShowConsole) {
    instanceOptions.showLog = instanceCFG.ShowConsole === 'true'
  }
  if (instanceCFG.notes) {
    instanceOptions.description = instanceCFG.notes
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

  instanceOptions.runtime!.optifine = manifest.json.components.find((c) => c.uid === 'optifine.Optifine')?.version ?? ''
  instanceOptions.runtime!.quiltLoader ||= manifest.json.components.find((c) => c.uid === 'org.quiltmc.quilt-loader')?.version ?? ''

  instanceOptions.resourcepacks = true
  instanceOptions.shaderpacks = true

  return instanceOptions
}

/**
 * Parse MultiMC instance files
 */
export async function parseMultiMCInstanceFiles(instancePath: string): Promise<InstanceFile[]> {
  const gameDirectory = getMultiMCGameDirectory(instancePath)
  const sharedFolders = new Set(['libraries', 'assets', 'versions', 'java_versions', 'jre'])
  const files = await getInstanceFiles(gameDirectory, undefined, (path) => sharedFolders.has(path.split('/')[0]))

  for (const [f] of files) {
    f.downloads = [pathToFileURL(join(gameDirectory, f.path)).toString()]
  }

  return files.map(([file]) => file)
}
