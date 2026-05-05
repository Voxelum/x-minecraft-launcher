/**
 * @module @xmcl/world
 */
import { deserialize } from '@xmcl/nbt'
import { FileSystem, openFileSystem } from '@xmcl/system'

function findVersion(arr: bigint[], bitLen: number): string {
  const index = 4096
  const offset = index * bitLen
  const j = offset >> 6
  if (arr[j] !== undefined) {
    return 'post116'
  }
  return 'pre116'
}

/**
 * Create bit vector from a long array
 */
function createBitVectorPre116(arr: bigint[], bitLen: number): number[] {
  const maxEntryValue = getMask(bitLen)
  const result = new Array<number>(4096)
  for (let i = 0; i < 4096; ++i) {
    result[i] = Number(seekPre116(arr, bitLen, i, maxEntryValue))
  }
  return result
}

function getMask(bitLen: number) {
  return (1n << BigInt(bitLen)) - 1n
}

/**
 * Seek block id from a long array (new chunk format)
 * @param data The block state id long array
 * @param bitLen The bit length
 * @param index The index (composition of xyz) in chunk
 * @param maxEntryValue The max entry value
 */
function seekPre116(
  data: bigint[],
  bitLen: number,
  index: number,
  maxEntryValue = getMask(bitLen),
) {
  const offset = index * bitLen
  const j = offset >> 6
  const k = ((index + 1) * bitLen - 1) >>> 6
  const l = offset ^ (j << 6)

  if (j === k) {
    return Number((data[j] >> BigInt(l)) & maxEntryValue)
  } else {
    const shiftLeft = 64 - l
    const v = (data[j] >> BigInt(l)) | (data[k] << BigInt(shiftLeft))
    return Number(v & maxEntryValue)
  }
}

/**
 * Create bit vector from a long array
 */
function createBitVectorPost116(arr: bigint[], bitLen: number): number[] {
  const maxEntryValue = getMask(bitLen)
  const result = new Array<number>(4096)
  for (let i = 0; i < 4096; ++i) {
    result[i] = Number(seekPost116(arr, bitLen, i, maxEntryValue))
  }

  return result
}

/**
 * Seek block id from a long array (new chunk format)
 * @param blockstates The block state id long array
 * @param indexLength The bit length
 * @param index The index (composition of xyz) in chunk
 * @param maxEntryValue The max entry value
 *
 * @author Adapted from: Jean-Baptiste Skutnik's <https://github.com/spoutn1k> {@link https://github.com/spoutn1k/mcmap/blob/fec14647c600244bc7808b242b99331e7ee0ec38/src/chunk_format_versions/section_format.cpp| Reference C++ code}
 */
function seekPost116(
  blockstates: bigint[],
  indexLength: number,
  index: number,
  maxEntryValue = getMask(indexLength),
) {
  const blocksPerLong = Math.floor(64 / indexLength)
  const longIndex = Math.floor(index / blocksPerLong)
  const padding = Math.floor((index - longIndex * blocksPerLong) * indexLength)
  const long = blockstates[longIndex]
  const blockIndex = (long >> BigInt(padding)) & maxEntryValue
  return blockIndex
}

/**
 * Legacy algorithm to seek block state from chunk
 */
function seekLegacy(blocks: number[], data: number[], add: number[] | null, i: number) {
  function getFromNibbleArray(arr: number[], index: number) {
    const nibbled = index >>> 1
    if ((index & 1) === 0) {
      return arr[nibbled] & 15
    } else {
      return (arr[nibbled] >>> 4) & 15
    }
  }
  const additional = !add ? 0 : getFromNibbleArray(add, i)
  return (additional << 12) | ((blocks[i] & 255) << 4) | getFromNibbleArray(data, i)
}

function getChunkOffset(buffer: Uint8Array, x: number, z: number) {
  // get internal chunk offset should be in the rest of 5 bits (from >> 5)
  x &= 31
  z &= 31
  // the offset index stored at the begining
  // each offset takes 4 bytes
  const offsetBytesLocation = (x + z * 32) * 4
  const offsetBytes = buffer.slice(offsetBytesLocation, offsetBytesLocation + 4)
  // chunk offset
  const offset = (offsetBytes[0] << 16) | (offsetBytes[1] << 8) | offsetBytes[2]
  // chunk sections should be last 8 bits (1 byte)
  const sectors = offsetBytes[3]
  if (offset === 0) {
    return 0
  } else {
    return offset * 4096
  }
}

export class WorldReader {
  static async create(path: string | Uint8Array) {
    return new WorldReader(await openFileSystem(path))
  }

  constructor(private fs: FileSystem) {}
  /**
   * Get region data frame
   * @param chunkX The x value of chunk coord
   * @param chunkZ The z value of chunk coord
   */
  public async getRegionData(chunkX: number, chunkZ: number): Promise<RegionDataFrame> {
    const data: RegionDataFrame = await this.getMCAData('region', chunkX, chunkZ)
    return data
  }

  /**
   * Get entity data frame
   * @param chunkX The x value of chunk coord
   * @param chunkZ The z value of chunk coord
   */
  public async getEntityData(chunkX: number, chunkZ: number): Promise<RegionDataFrame> {
    /* To do: Add EntityRegionDataFrame to mirror getRegionData */
    const data = await this.getMCAData('entities', chunkX, chunkZ)
    return data
  }

  /**
   * Get mca data frame
   * @param prefix The folder to load the .mca file from
   * @param chunkX The x value of chunk coord
   * @param chunkZ The z value of chunk coord
   */
  public async getMCAData(
    prefix: string,
    chunkX: number,
    chunkZ: number,
  ): Promise<RegionDataFrame> {
    // The region file coord with chunk is chunk coord shift by 5
    const path = this.fs.join(prefix, `r.${chunkX >> 5}.${chunkZ >> 5}.mca`)

    const buffer = await this.fs.readFile(path)
    const off = getChunkOffset(buffer, chunkX, chunkZ)

    const lengthBuf = buffer.slice(off, off + 4)
    const length = (lengthBuf[0] << 24) | (lengthBuf[1] << 16) | (lengthBuf[2] << 8) | lengthBuf[3]
    const format = buffer[off + 4]
    if (format !== 1 && format !== 2) {
      throw new Error(`Illegal Chunk format ${format} on (${prefix} | ${chunkX}, ${chunkZ})!`)
    }
    const compressed = format === 1 ? ('gzip' as const) : ('deflate' as const)
    const chunkData = buffer.slice(off + 5, off + 5 + length)
    return deserialize(chunkData, { compressed })
  }

  /**
   * Read the level data
   */
  public async getLevelData(): Promise<LevelDataFrame> {
    return this.fs
      .readFile('level.dat')
      .then((b) => deserialize(b, { compressed: 'gzip' }))
      .then((d: any) => d.Data)
  }

  public async getPlayerData(): Promise<PlayerDataFrame[]> {
    const files = await this.fs.listFiles('playerdata')
    return Promise.all(
      files.map((f) =>
        this.fs
          .readFile(this.fs.join('playerdata', f))
          .then((b) => deserialize<PlayerDataFrame>(b, { compressed: 'gzip' })),
      ),
    )
  }

  public async getAdvancementsData(): Promise<AdvancementDataFrame[]> {
    const files = await this.fs.listFiles('advancements')
    return Promise.all(
      files
        .filter((f) => f.endsWith('.dat'))
        .map((f) =>
          this.fs
            .readFile(this.fs.join('advancements', f))
            .then((b) => deserialize<AdvancementDataFrame>(b)),
        ),
    )
  }
}

/**
 * The chunk index is a number in range [0, 4096), which is mapped position from (0,0,0) to (16,16,16) inside the chunk.
 */
export type ChunkIndex = number

/**
 * Get chunk index from position.
 * All x, y, z should be in range [0, 16)
 *
 * @param x The position x. Should be in range [0, 16)
 * @param y The position y. Should be in range [0, 16)
 * @param z The position z. Should be in range [0, 16)
 */
export function getIndexInChunk(x: number, y: number, z: number): ChunkIndex {
  return ((y & 15) << 8) | ((z & 15) << 4) | (x & 15)
}

/**
 * Get in-chunk coordination from chunk index
 * @param index The index number in chunk
 */
export function getCoordFromIndex(index: ChunkIndex) {
  const x = index & 15
  const y = (index >>> 8) & 15
  const z = (index >>> 4) & 15
  return {
    x,
    y,
    z,
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace RegionReader {
  /**
   * Get a chunk section in a region by chunk Y value.
   * @param region The region
   * @param chunkY The y value of the chunk. It should be from [0, 16)
   */
  export function getSection(region: RegionDataFrame, chunkY: number) {
    // the new region has a section.Y === -1
    return region.Level.Sections[0].Y === 0
      ? region.Level.Sections[chunkY]
      : region.Level.Sections[chunkY + 1]
  }

  /**
   * Returns the palette, blockStates and bitLength for a section
   * @param section The chunk section
   */
  export function getSectionInformation(section: NewRegionSectionDataFrame) {
    let blockStates = section.BlockStates
    let palette = section.Palette

    if (blockStates === undefined) {
      blockStates = (section.block_states || {}).data
    }
    if (palette === undefined) {
      palette = (section.block_states || {}).palette
    }

    if (palette === undefined || blockStates === undefined) {
      palette = []
      blockStates = []
    }

    let bitLength = Math.ceil(Math.log2(palette.length))
    if (bitLength < 4) {
      bitLength = 4
    }

    return {
      palette,
      blockStates,
      bitLength,
    }
  }

  /**
   * Create an array of block ids from the chunk section given
   * @param section The chunk section
   */
  export function getSectionBlockIdArray(section: NewRegionSectionDataFrame) {
    const sectionInformation = getSectionInformation(section)

    const version = findVersion(sectionInformation.blockStates, sectionInformation.bitLength)
    if (version === 'pre116') {
      return createBitVectorPre116(sectionInformation.blockStates, sectionInformation.bitLength)
    } else {
      return createBitVectorPost116(sectionInformation.blockStates, sectionInformation.bitLength)
    }
  }

  /**
   * Walk through all the position in this chunk and emit all the id in every position.
   * @param section The chunk section
   * @param reader The callback which will receive the position + state id.
   */
  export function walkBlockStateId(
    section: RegionSectionDataFrame,
    reader: (x: number, y: number, z: number, id: number) => void,
  ): void {
    let seekFunc: (index: number) => number
    if ('Blocks' in section) {
      const add = section.Add
      const data = section.Data
      const blocks = section.Blocks
      seekFunc = (i) => seekLegacy(blocks, data, add, i)
    } else {
      const vector = getSectionBlockIdArray(section)
      seekFunc = (i) => vector[i]
    }
    for (let i = 0; i < 4096; ++i) {
      const x = i & 15
      const y = (i >>> 8) & 15
      const z = (i >>> 4) & 15
      const id = seekFunc(i)
      reader(x, y, z, id)
    }
  }

  /**
   * Seek the section and get the block state id from the section.
   * @param section The section
   * @param index The chunk index
   */
  export function seekBlockStateId(
    section: NewRegionSectionDataFrame | LegacyRegionSectionDataFrame,
    index: ChunkIndex,
  ) {
    if ('Blocks' in section) {
      return seekLegacy(section.Blocks, section.Data, section.Add, index)
    }

    const sectionInformation = getSectionInformation(section)

    const version = findVersion(sectionInformation.blockStates, sectionInformation.bitLength)

    if (version === 'pre116') {
      return Number(seekPre116(sectionInformation.blockStates, sectionInformation.bitLength, index))
    } else {
      return Number(
        seekPost116(sectionInformation.blockStates, sectionInformation.bitLength, index),
      )
    }
  }

  /**
   * Seek the block state data from new region format.
   * @param section The new region section
   * @param index The chunk index, which is a number in range [0, 4096)
   */
  export function seekBlockState(
    section: NewRegionSectionDataFrame,
    index: ChunkIndex,
  ): BlockStateData {
    const sectionInformation = getSectionInformation(section)
    const blockStateId = seekBlockStateId(section, index)

    return sectionInformation.palette[blockStateId]
  }
}

/**
 * The Minecraft provided block state info. Only presented in the version >= 1.13 chunk data.
 */
export interface BlockStateData {
  Name: string
  Properties: { [key: string]: string }
}

export enum GameType {
  NON = -1,
  SURVIVAL = 0,
  CREATIVE = 1,
  ADVENTURE = 2,
  SPECTATOR = 3,
}
export interface PlayerDataFrame {
  UUIDLeast: bigint
  UUIDMost: bigint
  DataVersion: number

  Pos: [number, number, number]
  Rotation: [number, number, number]
  Motion: [number, number, number]
  Dimension: number

  SpawnX: number
  SpawnY: number
  SpawnZ: number

  playerGameType: number

  Attributes: Array<{
    Base: number
    Name: string
  }>

  HurtTime: number
  DeathTime: number
  HurtByTimestamp: number
  SleepTimer: number
  SpawnForced: number
  FallDistance: number
  SelectedItemSlot: number
  seenCredits: number

  Air: number
  AbsorptionAmount: number
  Invulnerable: number
  FallFlying: number
  PortalCooldown: number
  Health: number
  OnGround: number
  XpLevel: number
  Score: number
  Sleeping: number
  Fire: number
  XpP: number
  XpSeed: number
  XpTotal: number

  foodLevel: number
  foodExhaustionLevel: number
  foodTickTimer: number
  foodSaturationLevel: number

  recipeBook: {
    isFilteringCraftable: number
    isGuiOpen: number
  }
  abilities: {
    invulnerable: number
    mayfly: number
    instabuild: number
    walkSpeed: number
    mayBuild: number
    flying: number
    flySpeed: number
  }
}

type StringBoolean = 'true' | 'false'
export interface LevelDataFrame {
  BorderCenterX: number
  BorderCenterZ: number
  BorderDamagePerBlock: number
  BorderSafeZone: number
  BorderSize: number
  BorderSizeLerpTarget: number
  BorderSizeLerpTime: bigint
  BorderWarningBlocks: number
  BorderWarningTime: number
  DataVersion: number
  DayTime: bigint
  Difficulty: number
  DifficultyLocked: number
  DimensionData: {
    [dimension: number]: {
      DragonFight: {
        Gateways: number[]
        DragonKilled: number
        PreviouslyKilled: number
        ExitPortalLocation?: [number, number, number]
      }
    }
  }
  GameRules: {
    doTileDrops: StringBoolean
    doFireTick: StringBoolean
    gameLoopFunction: string
    maxCommandChainLength: string
    reducedDebugInfo: string
    naturalRegeneration: string
    disableElytraMovementCheck: string
    doMobLoot: StringBoolean
    announceAdvancements: string
    keepInventory: StringBoolean
    doEntityDrops: StringBoolean
    doLimitedCrafting: StringBoolean
    mobGriefing: StringBoolean
    randomTickSpeed: string
    commandBlockOutput: string
    spawnRadius: string
    doMobSpawning: StringBoolean
    maxEntityCramming: string
    logAdminCommands: string
    spectatorsGenerateChunks: string
    doWeatherCycle: StringBoolean
    sendCommandFeedback: string
    doDaylightCycle: StringBoolean
    showDeathMessages: StringBoolean
  }
  GameType: GameType
  LastPlayed: bigint
  LevelName: string
  MapFeatures: number
  Player: PlayerDataFrame
  RandomSeed: bigint
  WorldGenSettings: {
    seed: bigint
    generate_features: 1 | 0
    bonus_chest: 1 | 0
    dimensions: {
      'minecraft:overworld': {}
      'minecraft:the_nether': {}
      'minecraft:the_end': {}
      [key: string]: object
    }
  }
  readonly SizeOnDisk: bigint
  SpawnX: number
  SpawnY: number
  SpawnZ: number
  Time: bigint
  Version: {
    Snapshot: number
    Id: number
    Name: string
  }
  allowCommands: number
  clearWeatherTime: number
  generatorName:
    | 'default'
    | 'flat'
    | 'largeBiomes'
    | 'amplified'
    | 'buffet'
    | 'debug_all_block_states'
    | string
  generatorOptions: string
  generatorVersion: number
  hardcore: number
  initialized: number
  rainTime: number
  raining: number
  thunderTime: number
  thundering: number
  version: number
}
export interface AdvancementDataFrame {
  display?: {
    background?: string
    description: object | string
    show_toast: boolean
    announce_to_chat: boolean
    hidden: boolean
  }
  parent?: string
  criteria: { [name: string]: { trigger: string; conditions: object } }
  requirements: string[]
  rewards: { recipes: string[]; loot: string[]; experience: number; function: string }
}

export interface ItemStackDataFrame {
  Slot: number
  id: string
  Count: number
  Damage: number
  tag?: {
    // general tags
    Unbreakable: number
    CanDestroy: string[]

    // block tags
    CanPlaceOn: string[]
    BlockEntityTag: object

    // enchantments
    ench: Array<{ id: number; lvl: number }>
    StoredEnchantments: Array<{ id: number; lvl: number }>
    RepairCost: number

    // attribute modifiers
    AttributeModifiers: Array<{
      AttributeName: string
      Name: string
      Slot: string
      Operation: number
      Amount: number
      UUIDMost: bigint
      UUIDLeast: bigint
    }>

    // potion effects
    CustomPotionEffects: Array<{
      Id: number
      Amplifier: number
      Duration: number
      Ambient: number
      ShowParticles: number
    }>
    Potion: string
    CustomPotionColor: number

    // display properties
    display: Array<{ color: number; Name: string; LocName: string; Lore: string[] }>
    HideFlags: number

    // written books
    resolved: number
    /**
     * The copy tier of the book. 0 = original, number = copy of original, number = copy of copy, number = tattered.
     * If the value is greater than number, the book cannot be copied. Does not exist for original books.
     * If this tag is missing, it is assumed the book is an original. 'Tattered' is unused in normal gameplay, and functions identically to the 'copy of copy' tier.
     */
    generation: number
    author: string
    title: string
    /**
     * A single page in the book. If generated by writing in a book and quill in-game, each page is a string in double quotes and uses the escape sequences \" for a double quote,
     * for a line break and \\ for a backslash. If created by commands or external tools, a page can be a serialized JSON object or an array of strings and/or objects (see Commands#Raw JSON text) or an unescaped string.
     */
    pages: string[]

    // player heads
  }
}
export interface TileEntityDataFrame {
  x: number
  y: number
  z: number
  Items: ItemStackDataFrame[]
  id: string
  [key: string]: any
}
export type LegacyRegionSectionDataFrame = {
  Blocks: Array<number>
  Data: Array<number>
  Add: Array<number>
  BlockLight: number[]
  SkyLight: number[]
  Y: number
}
export type NewRegionSectionDataFrame = {
  BlockStates?: bigint[]
  Palette?: Array<BlockStateData>
  block_states?: {
    data: bigint[]
    palette: Array<BlockStateData>
  }
  Data: number[]
  BlockLight: number[]
  SkyLight: number[]
  Y: number
}
export type RegionSectionDataFrame = LegacyRegionSectionDataFrame | NewRegionSectionDataFrame
export interface RegionDataFrame {
  Level: {
    xPos: number
    zPos: number

    LightPopulated: number
    LastUpdate: bigint
    InhabitedTime: bigint

    HeightMap: number[]
    Biomes: number[]
    Entities: object[]
    TileEntities: TileEntityDataFrame[]
    Sections: RegionSectionDataFrame[]
  }
  DataVersion: number
  ForgeDataVersion?: number
}
