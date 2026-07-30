import { Exception, InstanceNotFoundException } from '../entities/exception'
import { InstallMarketOptions, InstallMarketOptionWithInstance } from '../entities/market'
import { InstanceDatapack, InstanceSave, InstanceSaveHeader, SaveDatapacks, SaveMetadata, Saves } from '../entities/save'
import { SharedState } from '../util/SharedState'
import { ServiceKey } from './Service'

export interface ExportSaveOptions {
  /**
   * The instance directory path, e.g. the path of .minecraft folder.
   *
   * This will be the active instance by default.
   */
  instancePath: string
  /**
   * The save folder name to export.
   */
  saveName: string
  /**
   * The destination full file path.
   */
  destination: string
  /**
   * Should export as zip
   * @default true
   */
  zip?: boolean
}
export interface ImportSaveOptions {
  /**
   * the save zip file or directory path
   */
  path: string
  /**
  * The destination instance directory path, e.g. the path of .minecraft folder.
  *
  * This will be the active instance by default.
  */
  instancePath: string
  /**
   * Linked curseforge
   */
  curseforge?: {
    projectId: number
    fileId: number
  }
  /**
   * The destination save folder name will be imported into.
   *
   * It will be the basename of the source file path if this is not present.
   */
  saveName?: string
}

export interface DeleteSaveOptions {
  /**
   * The save name will be deleted
   */
  saveName: string
  /**
   * The instance path of this save. If this is not presented, it will delete shared save.
   */
  instancePath?: string
}

export interface ShareSaveOptions {
  saveName: string
  instancePath: string
}

export interface UpdateSaveOptions {
  /**
   * The instance path
   */
  instancePath: string
  /**
   * The save name
   */
  saveName: string
  /**
   * Metadata to update
   */
  metadata: Partial<Pick<SaveMetadata, 'seed' | 'difficulty' | 'cheat' | 'levelName'>>
}

export interface CloneSaveOptions {
  /**
   * The source instance path. If it is not presented, it will use selected instance.
   */
  srcInstancePath: string
  /**
   * The destination instance path. If it is not presented, it will use selected instance.
   */
  destInstancePath: string | string[]
  /**
   * The save name to clone
   */
  saveName: string
  /**
   * The new save name.
   * @default Generated name from the `saveName`
   */
  newSaveName?: string
}

export function getInstanceSaveKey(path: string) {
  return `instance-saves://${path}`
}

export interface ImportDatapackOptions {
  /**
   * The owner save folder path.
   */
  savePath: string
  /**
   * The source datapack zip file or folder path.
   */
  path: string
}

export interface DeleteDatapackOptions {
  /**
   * The owner save folder path.
   */
  savePath: string
  /**
   * The datapack file/folder name to delete.
   */
  fileName: string
}

export type InstallDatapackMarketOptions = InstallMarketOptions & {
  /**
   * The owner save folder path to install the datapack into.
   */
  savePath: string
}

export interface LinkSaveAsServerWorldOptions {
  /**
   * The instance path
   */
  instancePath: string
  /**
   * The save name
   */
  saveName: string
}

export interface SaveRegionInfo {
  /**
   * The region x coord. Each region covers 32x32 chunks.
   */
  regionX: number
  /**
   * The region z coord. Each region covers 32x32 chunks.
   */
  regionZ: number
}

export interface RenderedSaveRegion {
  regionX: number
  regionZ: number
  /**
   * RGBA pixel buffer of the 512x512 region image (top-down surface colors).
   */
  data: Uint8Array
  /**
   * Length 1024. Whether a chunk exists at local index `(x & 31) + (z & 31) * 32`.
   */
  chunks: boolean[]
}

export interface DeleteSaveChunksOptions {
  /**
   * The save folder path.
   */
  savePath: string
  /**
   * The dimension id, e.g. `minecraft:overworld`.
   */
  dimension: string
  /**
   * The absolute chunk coordinates to delete.
   */
  chunks: Array<{ chunkX: number; chunkZ: number }>
}

/**
 * The raw, still-compressed payload of a single chunk extracted from a region
 * file. It can be written back verbatim into another save's region file.
 */
export interface SaveChunkData {
  /**
   * Absolute chunk x coordinate.
   */
  chunkX: number
  /**
   * Absolute chunk z coordinate.
   */
  chunkZ: number
  /**
   * Region-file compression type (1 = gzip, 2 = zlib, 3 = uncompressed).
   */
  compression: number
  /**
   * The compressed chunk payload.
   */
  data: Uint8Array
}

export interface CopySaveChunksOptions {
  /**
   * The source save folder path.
   */
  savePath: string
  /**
   * The dimension id, e.g. `minecraft:overworld`.
   */
  dimension: string
  /**
   * The absolute chunk coordinates to copy.
   */
  chunks: Array<{ chunkX: number; chunkZ: number }>
}

export interface PasteSaveChunksOptions {
  /**
   * The destination save folder path.
   */
  savePath: string
  /**
   * The destination dimension id, e.g. `minecraft:overworld`.
   */
  dimension: string
  /**
   * The chunks (previously copied via `copySaveChunks`) to write. Existing
   * chunks at the same coordinates are overwritten.
   */
  chunks: SaveChunkData[]
  /**
   * Chunk offset applied to every pasted chunk along X. When non-zero the
   * chunk's stored position is rewritten so the game loads it at the new
   * location. Defaults to 0 (paste at the original coordinates).
   */
  offsetX?: number
  /**
   * Chunk offset applied to every pasted chunk along Z.
   * @see offsetX
   */
  offsetZ?: number
}

/**
 * Provide the ability to preview saves data of an instance
 */
export interface InstanceSavesService {
  showDirectory(instancePath: string): Promise<void>
  /**
   * Read all saves under the instance folder
   * @param path The instance folder path
   */
  getInstanceSaves(path: string): Promise<InstanceSaveHeader[]>
  /**
   * Watch instances saves
   * @param path
   */
  watch(path: string): Promise<SharedState<Saves>>
  /**
   * Clone a save under an instance to one or multiple instances.
   *
   * @param options
   */
  cloneSave(options: CloneSaveOptions): Promise<void>

  shareSave(options: ShareSaveOptions): Promise<void>
  /**
   * Update save metadata (seed, difficulty, cheat, levelName)
   */
  updateSave(options: UpdateSaveOptions): Promise<void>
  /**
   * Delete a save in a specific instance.
   */
  deleteSave(options: DeleteSaveOptions): Promise<void>
  /**
   * Import a zip or folder save to the target instance.
   *
   * If the instancePath is not presented in the options, it will use the current selected instancePath.
   *
   * @returns The imported save path
   */
  importSave(options: ImportSaveOptions): Promise<string>
  /**
   * Export a save from a managed instance to an external location.
   *
   * You can choose export the save to zip or a folder.
   */
  exportSave(options: ExportSaveOptions): Promise<void>
  /**
   * Link saves folder to shared-saves.
   *
   * If the saves exists, it will move all saves to shared-saves and link the saves folder to shared-saves.
   */
  linkSharedSave(instancePath: string): Promise<void>

  isSaveLinked(instancePath: string): Promise<boolean>
  /**
   * Unlink saves folder from shared-saves.
   */
  unlinkSharedSave(instancePath: string): Promise<void>
  /**
   * Get the shared saves. The saves `instanceName` will be an empty string.
   */
  getSharedSaves(): Promise<InstanceSave[]>

  linkSaveAsServerWorld(options: LinkSaveAsServerWorldOptions): Promise<void>

  /**
   * Get the linked save world path.
   * @param instancePath
   * @return The linked save world path. Empty string if it's a raw world folder, else it's linked folder existed. `undefined` if no folder existed.
   */
  getLinkedSaveWorld(instancePath: string): Promise<string | undefined>
  /**
   * Install a save from market.
   */
  installFromMarket(options: InstallMarketOptionWithInstance): Promise<string>

  getWorldGenSettings(instancePath: string): Promise<{
    seed: bigint
    dimensions: Record<string, {
      type: string
      generator: {
        type: string
        biome_source?: any
        settings?: any
      }
    }>
  } | undefined>

  /**
   * List the dimensions that contain region (chunk) data for a save.
   * @param savePath The save folder path
   */
  listSaveDimensions(savePath: string): Promise<string[]>
  /**
   * List the available region files (each covers 32x32 chunks) of a dimension.
   * @param savePath The save folder path
   * @param dimension The dimension id, e.g. `minecraft:overworld`
   */
  getSaveRegions(savePath: string, dimension: string): Promise<SaveRegionInfo[]>
  /**
   * Render a region file into a 512x512 RGBA top-down surface map.
   * @param savePath The save folder path
   * @param dimension The dimension id
   * @param regionX The region x coord
   * @param regionZ The region z coord
   * @param maxHeight The highest world Y to render; blocks above are peeled away
   */
  renderSaveRegion(savePath: string, dimension: string, regionX: number, regionZ: number, maxHeight?: number): Promise<RenderedSaveRegion>
  /**
   * Delete the given chunks from a dimension. Empty region files are removed.
   */
  deleteSaveChunks(options: DeleteSaveChunksOptions): Promise<void>
  /**
   * Read the raw payload of the given chunks so they can be pasted into another
   * save. Missing chunks are skipped.
   */
  copySaveChunks(options: CopySaveChunksOptions): Promise<SaveChunkData[]>
  /**
   * Write previously copied chunks into a dimension at their original
   * coordinates, overwriting any existing chunk there.
   */
  pasteSaveChunks(options: PasteSaveChunksOptions): Promise<void>

  /**
   * Watch the datapacks installed under a save's `datapacks/` folder.
   * @param savePath The save folder path
   */
  watchSaveDatapacks(savePath: string): Promise<SharedState<SaveDatapacks>>
  /**
   * Read all datapacks installed across every save of an instance.
   * Each returned datapack carries its owning `savePath`.
   * @param instancePath The instance folder path
   */
  getInstanceSaveDatapacks(instancePath: string): Promise<InstanceDatapack[]>
  /**
   * Import a local datapack (zip file or folder) into a save's `datapacks/` folder.
   * @returns The imported datapack path
   */
  importDatapack(options: ImportDatapackOptions): Promise<string>
  /**
   * Delete a datapack from a save's `datapacks/` folder.
   */
  deleteDatapack(options: DeleteDatapackOptions): Promise<void>
  /**
   * Install a datapack from curseforge or modrinth market into a save's `datapacks/` folder.
   * @returns The installed datapack paths
   */
  installDatapackFromMarket(options: InstallDatapackMarketOptions): Promise<string[]>
}

export const InstanceSavesServiceKey: ServiceKey<InstanceSavesService> = 'InstanceSavesService'

export type ImportSaveExceptions = {
  type: 'instanceImportIllegalSave'
  path: string
}

export class ImportSaveException extends Exception<ImportSaveExceptions> { }
