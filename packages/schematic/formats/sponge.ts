import { deserialize, serialize, TagType } from '@xmcl/nbt'
import { Blueprint, BlockState, BlueprintFormat, parseBlockState, stringifyBlockState } from '../model'
import { compoundListSchema } from '../nbtSchema'
import { withSchema, writeVarInts } from '../nbtUtil'

/**
 * Read a Sponge schematic (`.schem`). Supports schematic versions 1-3.
 */
export async function readSponge(data: Uint8Array): Promise<Blueprint> {
  const root: any = await deserialize(data, { compressed: 'gzip' })
  const schem = root?.Schematic ?? root
  const invalid = (reason: string): never => {
    throw new Error(`Invalid or unsupported Sponge schematic: ${reason}`)
  }
  if (!schem || typeof schem !== 'object') invalid('expected a compound')
  if (schem.Materials === 'Alpha' || (schem.Blocks && !schem.Version)) {
    invalid('legacy MCEdit .schematic is not supported; convert it to Sponge .schem first')
  }
  if (![1, 2, 3].includes(schem.Version)) invalid('expected Version 1, 2 or 3')

  const width: number = schem.Width
  const height: number = schem.Height
  const length: number = schem.Length
  const dataVersion: number | undefined = schem.DataVersion

  let paletteObj: Record<string, number>
  let blockData: ArrayLike<number>
  let blockEntitiesRaw: any[]

  if (schem.Version === 3) {
    if (!schem.Blocks || typeof schem.Blocks !== 'object') invalid('missing Blocks compound')
    // version 3
    paletteObj = schem.Blocks.Palette
    blockData = schem.Blocks.Data
    blockEntitiesRaw = schem.Blocks.BlockEntities ?? []
  } else {
    // version 1/2
    paletteObj = schem.Palette
    blockData = schem.BlockData
    blockEntitiesRaw = (schem.Version === 1 ? schem.TileEntities : schem.BlockEntities) ?? []
  }

  // Bound allocation before trusting dimensions, sparse palette IDs or block data.
  const volume = width * height * length
  if (![width, height, length].every((v) => Number.isInteger(v) && v > 0 && v <= 32767)
    || !Number.isSafeInteger(volume) || volume > 16 * 1024 * 1024) {
    invalid('invalid dimensions or volume exceeds 16777216 blocks')
  }
  if (!paletteObj || typeof paletteObj !== 'object' || Array.isArray(paletteObj) || ArrayBuffer.isView(paletteObj)) invalid('missing Palette compound')
  const entries = Object.entries(paletteObj)
  if (!entries.length || entries.length > 65536) invalid('Palette must contain 1-65536 states')
  const ids = new Set<number>()
  for (const [state, id] of entries) {
    if (!state || !Number.isInteger(id) || id < 0 || id > 65535 || ids.has(id)) invalid('invalid or duplicate palette ID')
    ids.add(id)
  }
  const maxIndex = Math.max(...ids)
  const palette: BlockState[] = new Array(maxIndex + 1)
  for (const [str, idx] of entries) palette[idx] = parseBlockState(str)
  for (let i = 0; i < palette.length; i++) {
    if (!palette[i]) palette[i] = { name: 'minecraft:air' }
  }
  if (!blockData || (!Array.isArray(blockData) && !ArrayBuffer.isView(blockData))
    || blockData.length > volume * 3) invalid('missing or oversized block data')
  const size = { x: width, y: height, z: length }
  const blocks = new Uint16Array(volume)
  let offset = 0
  let count = 0
  while (offset < blockData.length) {
    let value = 0
    let shift = 0
    let byte: number
    do {
      if (offset >= blockData.length || shift > 14) invalid('truncated or oversized block VarInt')
      byte = blockData[offset++] & 0xff
      value |= (byte & 0x7f) << shift
      shift += 7
    } while (byte & 0x80)
    if (count >= volume || !ids.has(value)) invalid('block data references an unknown state or exceeds dimensions')
    blocks[count++] = value
  }
  if (count !== volume) invalid('block count does not match dimensions')
  if (!Array.isArray(blockEntitiesRaw) || !Array.isArray(schem.Entities ?? [])) invalid('invalid entity list')

  const blockEntities = blockEntitiesRaw.map((be) => {
    if (!be || typeof be !== 'object') invalid('invalid block entity compound')
    const pos: number[] = be.Pos ?? [be.x ?? 0, be.y ?? 0, be.z ?? 0]
    if (pos.length !== 3 || !Array.from(pos).every(Number.isFinite)) invalid('invalid block entity position')
    const { Pos, x, y, z, ...rest } = be
    return { pos: [pos[0], pos[1], pos[2]] as [number, number, number], data: rest }
  })

  const entities = (schem.Entities ?? []).map((e: any) => {
    if (!e || typeof e !== 'object') invalid('invalid entity compound')
    const pos: number[] = e.Pos ?? [0, 0, 0]
    if (pos.length !== 3 || !Array.from(pos).every(Number.isFinite)) invalid('invalid entity position')
    return { pos: [pos[0], pos[1], pos[2]] as [number, number, number], data: e }
  })

  return {
    format: BlueprintFormat.Schem,
    name: schem.Metadata?.Name,
    author: schem.Metadata?.Author,
    dataVersion,
    size,
    palette,
    blocks,
    blockEntities,
    entities,
  }
}

/**
 * Write a Sponge schematic version 2 (`.schem`).
 */
export async function writeSponge(blueprint: Blueprint): Promise<Uint8Array> {
  const { size, palette, blocks } = blueprint

  const paletteMap: Record<string, number> = {}
  const paletteSchema: Record<string, TagType> = {}
  palette.forEach((state, idx) => {
    const key = stringifyBlockState(state)
    paletteMap[key] = idx
    paletteSchema[key] = TagType.Int
  })

  const blockData = writeVarInts(blocks)

  const blockEntities = blueprint.blockEntities.map((be) => ({
    ...be.data,
    Pos: [be.pos[0], be.pos[1], be.pos[2]],
  }))

  const root: any = {
    Version: 2,
    DataVersion: blueprint.dataVersion ?? 3700,
    Width: size.x,
    Height: size.y,
    Length: size.z,
    PaletteMax: palette.length,
    Palette: withSchema(paletteMap, paletteSchema),
    BlockData: blockData,
    BlockEntities: blockEntities,
    Metadata: withSchema({
      Name: blueprint.name ?? '',
      Author: blueprint.author ?? 'XMCL',
    }, { Name: TagType.String, Author: TagType.String }),
  }

  withSchema(root, {
    Version: TagType.Int,
    DataVersion: TagType.Int,
    Width: TagType.Short,
    Height: TagType.Short,
    Length: TagType.Short,
    PaletteMax: TagType.Int,
    Palette: paletteSchema,
    BlockData: TagType.ByteArray,
    BlockEntities: compoundListSchema(blockEntities),
    Metadata: { Name: TagType.String, Author: TagType.String },
  })

  return serialize(root, { compressed: 'gzip', filename: 'Schematic' })
}
