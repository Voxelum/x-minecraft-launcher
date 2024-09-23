import { WorldReader } from '@xmcl/game-data'
import { InstanceSave, InstanceSaveHeader, ResourceSaveMetadata, SaveMetadata } from '@xmcl/runtime-api'
import { FileSystem } from '@xmcl/system'
import { readdir, readFile, readlink } from 'fs-extra'
import { basename, join } from 'path'
import { exists } from '../util/fs'

/**
 * Find the relative path of the save relative to the file system.
 * @param fs The file system
 * @param searchPath A path relative to the file system
 * @returns A relative path to the file system root
 */
export async function findLevelRootDirectory(fs: FileSystem, searchPath: string): Promise<string | undefined> {
  if (searchPath !== '' && !(await fs.isDirectory(searchPath))) return undefined
  if (await fs.existsFile(fs.join(searchPath, 'level.dat'))) return searchPath
  for (const subdir of await fs.listFiles(searchPath)) {
    if (subdir === '') continue
    const result = await findLevelRootDirectory(fs, fs.join(searchPath, subdir))
    if (result) return result
  }
  return undefined
}

/**
 * Read the basic save metadata
 * @param save The save object or path
 */
export async function readSaveMetadata(save: string | Uint8Array | FileSystem | WorldReader): Promise<SaveMetadata> {
  const resolveReader = () => {
    if (typeof save === 'string' || save instanceof Uint8Array) {
      return WorldReader.create(save)
    }
    if (save instanceof WorldReader) {
      return save
    }
    return new WorldReader(save)
  }
  const reader = await resolveReader()
  const level = await reader.getLevelData()
  const adv = await reader.getAdvancementsData().catch(() => [])
  let advancements = 0
  if (adv.length !== 0) {
    advancements = adv.length
  } else if (typeof save === 'string') {
    const files = await readdir(join(save, 'advancements')).catch(() => [])
    advancements = files.filter(f => f.endsWith('.json')).length
  }
  return {
    mode: level.GameType,
    levelName: level.LevelName,
    gameVersion: level.Version.Name,
    difficulty: level.Difficulty,
    cheat: false,
    time: Number(level.Time),
    lastPlayed: Number(level.LastPlayed),
    advancements,
  }
}

export async function readResourceSaveMetadata(resourcePath: string | Uint8Array | FileSystem | WorldReader, root: string): Promise<ResourceSaveMetadata> {
  return {
    root,
    ...(await readSaveMetadata(resourcePath)),
  }
}

export async function readLinkedCurseforge(path: string) {
  const cfMetadata = join(path, '.curseforge')
  if (!await exists(cfMetadata)) return undefined
  return JSON.parse(await readFile(cfMetadata, 'utf-8')) as { projectId: number; fileId: number }
}

/**
 * Get the instance save preview information
 * @param path The path of the save directory
 * @param instanceName The instance name
 */
export async function getInstanceSaveHeader(path: string, instanceName: string): Promise<InstanceSaveHeader> {
  return {
    path,
    instanceName,
    name: basename(path),
    linkTo: await readlink(path).catch(() => undefined),
    icon: 'http://launcher/media?path=' + join(path, 'icon.png'),
  }
}

/**
 * Load the instance save metadata
 *
 * @param path The path of the save directory
 * @param instanceName The instance name
 */
export async function readInstanceSaveMetadata(path: string, instanceName: string): Promise<InstanceSave> {
  return {
    ...await getInstanceSaveHeader(path, instanceName),
    ...(await readSaveMetadata(path)),
    curseforge: await readLinkedCurseforge(path),
  }
}
