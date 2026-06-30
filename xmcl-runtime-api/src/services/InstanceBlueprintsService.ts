import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

export type BlueprintFormatType = 'litematic' | 'schem' | 'schematic' | 'structure' | 'buildinggadget'

export interface BlueprintMaterial {
  block: string
  count: number
}

export interface BlueprintBlockState {
  name: string
  properties?: Record<string, string>
}

export interface BlueprintInfo {
  format: string
  name?: string
  author?: string
  description?: string
  dataVersion?: number
  size: { x: number; y: number; z: number }
  blockCount: number
  materials: BlueprintMaterial[]
  palette: BlueprintBlockState[]
  /**
   * Flattened `[x, y, z, paletteIndex]` quadruples for every non-air block,
   * used by the 3D preview.
   */
  voxels: number[]
}

export interface BlueprintConvertOptions {
  instancePath: string
  /**
   * The blueprint file name (relative to the `schematics` folder) or an
   * absolute path.
   */
  fileName: string
  target: BlueprintFormatType
  /**
   * The output file name. Defaults to the source name with the target
   * extension.
   */
  output?: string
}

export interface BlueprintReplaceOptions {
  instancePath: string
  fileName: string
  replacements: { from: string; to: string }[]
  mode: 'simple' | 'precise'
  /**
   * When set, write the result to a new file instead of overwriting the source.
   */
  output?: string
}

/**
 * Manage blueprint / schematic files (litematic, schem, structure nbt, building
 * gadget) of an instance, plus conversion, smart block replacement and 3D
 * preview support.
 */
export interface InstanceBlueprintsService extends InstanceResourcesService {
  /**
   * Read full blueprint info including the material list, palette and the voxel
   * grid for the 3D preview. The result is cached in the resource database;
   * pass `force` to bypass the cache and re-read the file.
   */
  getBlueprintInfo(instancePath: string, fileName: string): Promise<BlueprintInfo>
  /**
   * Resolve the localized display names for the given block ids by reading the
   * lang files from the installed jars. Blocks without a translation are
   * omitted. `locale` is an app/vue-i18n locale (e.g. `zh-CN`).
   */
  getBlockNames(blocks: string[], locale: string): Promise<Record<string, string>>
  /**
   * Convert a blueprint to another format. Returns the new file path.
   */
  convertBlueprint(options: BlueprintConvertOptions): Promise<string>
  /**
   * Replace blocks in a blueprint. Returns the written file path.
   */
  replaceBlueprintBlocks(options: BlueprintReplaceOptions): Promise<string>
}

export const InstanceBlueprintsServiceKey: ServiceKey<InstanceBlueprintsService> = 'InstanceBlueprintsService'
