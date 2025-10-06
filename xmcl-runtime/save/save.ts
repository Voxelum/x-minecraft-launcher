import { LevelDataFrame, WorldReader } from '@xmcl/game-data'
import { deserialize, serialize } from '@xmcl/nbt'
import { InstanceSave, InstanceSaveHeader, ResourceSaveMetadata, SaveMetadata } from '@xmcl/runtime-api'
import { FileSystem } from '@xmcl/system'
import { readdir, readFile, readlink, writeFile } from 'fs-extra'
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
    seed: level.RandomSeed?.toString() || level.WorldGenSettings?.seed?.toString(),
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

/**
 * Update save metadata by writing to level.dat
 * @param path The path of the save directory
 * @param metadata Partial metadata to update
 */
export async function updateSaveMetadata(path: string, metadata: Partial<Pick<SaveMetadata, 'seed' | 'difficulty' | 'cheat' | 'levelName'>>): Promise<void> {
  const levelDatPath = join(path, 'level.dat')
  
  // Read existing level.dat
  const buffer = await readFile(levelDatPath)
  const levelData: { Data: LevelDataFrame } = await deserialize(buffer, { compressed: 'gzip' })
  
  // Update fields in the Data section
  if (metadata.seed !== undefined) {
    if (levelData.Data.RandomSeed) {
      levelData.Data.RandomSeed = BigInt(metadata.seed)
    } else if (levelData.Data.WorldGenSettings?.seed) {
      levelData.Data.WorldGenSettings.seed = BigInt(metadata.seed)
    }
  }
  if (metadata.difficulty !== undefined) {
    levelData.Data.Difficulty = metadata.difficulty
  }
  if (metadata.cheat !== undefined) {
    levelData.Data.allowCommands = metadata.cheat ? 1 : 0
  }
  if (metadata.levelName !== undefined) {
    levelData.Data.LevelName = metadata.levelName
  }
  
  // Write back to level.dat
  const serialized = await serialize(levelData, { compressed: 'gzip' })
  await writeFile(levelDatPath, serialized)
}

/**
 * Read world generation settings from level.dat for map rendering
 * @param path The path of the save directory
 * @returns World generation settings including dimensions and biome sources
 */
export async function readWorldGenSettings(path: string): Promise<{
  seed: bigint
  dimensions: Record<string, {
    type: string
    generator: {
      type: string
      biome_source?: any
      settings?: any
    }
  }>
} | undefined> {
  try {
    const levelDatPath = join(path, 'level.dat')
    
    if (!await exists(levelDatPath)) {
      return undefined
    }
    
    // Read existing level.dat
    const buffer = await readFile(levelDatPath)
    const levelData: { Data: LevelDataFrame } = await deserialize(buffer, { compressed: 'gzip' })
    
    // Extract world generation settings
    const worldGenSettings = levelData.Data.WorldGenSettings
    if (!worldGenSettings) {
      // Fallback for older worlds without WorldGenSettings
      return undefined
    }
    
    return {
      seed: worldGenSettings.seed || levelData.Data.RandomSeed || BigInt(0),
      dimensions: worldGenSettings.dimensions as any || {},
    }
  } catch (err) {
    console.error('Failed to read world gen settings:', err)
    return undefined
  }
}
