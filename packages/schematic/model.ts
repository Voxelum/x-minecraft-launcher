/**
 * The supported blueprint/schematic file formats.
 */
export enum BlueprintFormat {
  /**
   * Litematica `.litematic` (投影)
   */
  Litematic = 'litematic',
  /**
   * Sponge schematic `.schem` (创世神 / WorldEdit modern)
   */
  Schem = 'schem',
  /**
   * Legacy MCEdit `.schematic` (创世神 / WorldEdit legacy)
   */
  Schematic = 'schematic',
  /**
   * Vanilla structure block `.nbt` (原版结构方块)
   */
  Structure = 'structure',
  /**
   * Building Gadgets template `.json` (建筑小帮手)
   */
  BuildingGadget = 'buildinggadget',
}

export const BLUEPRINT_EXTENSIONS: Record<string, BlueprintFormat> = {
  '.litematic': BlueprintFormat.Litematic,
  '.schem': BlueprintFormat.Schem,
  '.schematic': BlueprintFormat.Schematic,
  '.nbt': BlueprintFormat.Structure,
  '.json': BlueprintFormat.BuildingGadget,
}

export interface BlockState {
  /**
   * Full block id, e.g. `minecraft:chest`
   */
  name: string
  /**
   * Block state properties, e.g. `{ facing: 'north', type: 'single' }`
   */
  properties?: Record<string, string>
}

export interface BlueprintBlockEntity {
  /**
   * The position relative to the blueprint origin.
   */
  pos: [number, number, number]
  /**
   * Raw NBT compound for the block entity (without the x/y/z coordinate fields).
   */
  data: Record<string, any>
}

export interface BlueprintEntity {
  /**
   * The position relative to the blueprint origin.
   */
  pos: [number, number, number]
  /**
   * Raw NBT compound for the entity.
   */
  data: Record<string, any>
}

/**
 * A normalized, in-memory representation of a blueprint, decoupled from any
 * particular on-disk format. All readers produce this; all writers consume it.
 */
export interface Blueprint {
  format: BlueprintFormat
  name?: string
  author?: string
  description?: string
  /**
   * The Minecraft `DataVersion` the blueprint was created with, when known.
   */
  dataVersion?: number
  size: { x: number; y: number; z: number }
  /**
   * Block state palette. Index `0` is conventionally `minecraft:air`.
   */
  palette: BlockState[]
  /**
   * Flattened palette indices. The block at `(x, y, z)` is stored at
   * `x + size.x * (z + size.z * y)`.
   */
  blocks: Uint16Array
  blockEntities: BlueprintBlockEntity[]
  entities: BlueprintEntity[]
}

export function blockIndex(size: { x: number; y: number; z: number }, x: number, y: number, z: number) {
  return x + size.x * (z + size.z * y)
}

const AIR = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', 'air'])

export function isAir(state: BlockState | undefined) {
  return !state || AIR.has(state.name)
}

/**
 * Parse a block state string like `minecraft:chest[facing=north,type=single]`
 * into a {@link BlockState}.
 */
export function parseBlockState(input: string): BlockState {
  const open = input.indexOf('[')
  if (open === -1) {
    return { name: normalizeName(input) }
  }
  const name = normalizeName(input.slice(0, open))
  const inner = input.slice(open + 1, input.lastIndexOf(']'))
  const properties: Record<string, string> = {}
  for (const part of inner.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    properties[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return { name, properties }
}

/**
 * Convert a {@link BlockState} back to a string like
 * `minecraft:chest[facing=north,type=single]`.
 */
export function stringifyBlockState(state: BlockState): string {
  const keys = state.properties ? Object.keys(state.properties).sort() : []
  if (keys.length === 0) return state.name
  const props = keys.map((k) => `${k}=${state.properties![k]}`).join(',')
  return `${state.name}[${props}]`
}

function normalizeName(name: string) {
  const trimmed = name.trim()
  return trimmed.includes(':') ? trimmed : `minecraft:${trimmed}`
}

export function blockStateEquals(a: BlockState, b: BlockState) {
  if (a.name !== b.name) return false
  const ak = a.properties ? Object.keys(a.properties) : []
  const bk = b.properties ? Object.keys(b.properties) : []
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a.properties![k] !== b.properties?.[k]) return false
  }
  return true
}
