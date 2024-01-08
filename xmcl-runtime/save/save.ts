import { WorldReader } from '@xmcl/game-data'
import { InstanceSave, InstanceSaveMetadata, ResourceSaveMetadata, SaveMetadata } from '@xmcl/runtime-api'
import { FileSystem } from '@xmcl/system'
import { readdir } from 'fs-extra'
import { basename, join } from 'path'
import { exists, isDirectory } from '../util/fs'

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
 * Find the directory contains the level.dat
 */
export async function findLevelRootOnPath(path: string): Promise<string | undefined> {
  if (!(await isDirectory(path))) return undefined
  if (await exists(join(path, 'level.dat'))) return path
  for (const subdir of await readdir(path)) {
    const result = await findLevelRootOnPath(join(path, subdir))
    if (result) return result
  }
  return undefined
}

/**
 * Get the instance save preview information
 * @param path The path of the save directory
 * @param instanceName The instance name
 */
export function getInstanceSave(path: string, instanceName: string): InstanceSave {
  return {
    path,
    instanceName,
    name: basename(path),
    icon: 'http://launcher/media?path=' + join(path, 'icon.png'),
  }
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
  const adv = await reader.getAdvancementsData()
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

/**
 * Load the instance save metadata
 *
 * @param path The path of the save directory
 * @param instanceName The instance name
 */
export async function readInstanceSaveMetadata(path: string, instanceName: string): Promise<InstanceSaveMetadata> {
  return {
    ...getInstanceSave(path, instanceName),
    ...(await readSaveMetadata(path)),
  }
}
