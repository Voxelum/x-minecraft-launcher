import { deserialize, serialize, TagType } from '@xmcl/nbt'
import { Blueprint, BlockState, BlueprintFormat, parseBlockState, stringifyBlockState } from '../model'
import { compoundListSchema } from '../nbtSchema'
import { readVarInts, withSchema, writeVarInts } from '../nbtUtil'

/**
 * Read a Sponge schematic (`.schem`). Supports schematic versions 1-3.
 */
export async function readSponge(data: Uint8Array): Promise<Blueprint> {
  const root: any = await deserialize(data, { compressed: 'gzip' })
  const schem = root.Schematic ?? root

  const width: number = schem.Width
  const height: number = schem.Height
  const length: number = schem.Length
  const dataVersion: number | undefined = schem.DataVersion

  let paletteObj: Record<string, number>
  let blockData: ArrayLike<number>
  let blockEntitiesRaw: any[]

  if (schem.Blocks && schem.Blocks.Palette) {
    // version 3
    paletteObj = schem.Blocks.Palette
    blockData = schem.Blocks.Data
    blockEntitiesRaw = schem.Blocks.BlockEntities ?? []
  } else {
    // version 1/2
    paletteObj = schem.Palette
    blockData = schem.BlockData
    blockEntitiesRaw = schem.BlockEntities ?? []
  }

  const entries = Object.entries(paletteObj)
  const maxIndex = entries.reduce((m, [, v]) => Math.max(m, v as number), 0)
  const palette: BlockState[] = new Array(maxIndex + 1)
  for (const [str, idx] of entries) {
    palette[idx as number] = parseBlockState(str)
  }
  for (let i = 0; i < palette.length; i++) {
    if (!palette[i]) palette[i] = { name: 'minecraft:air' }
  }

  const indices = readVarInts(blockData)
  const size = { x: width, y: height, z: length }
  const blocks = new Uint16Array(width * height * length)
  for (let i = 0; i < indices.length && i < blocks.length; i++) {
    blocks[i] = indices[i]
  }

  const blockEntities = blockEntitiesRaw.map((be) => {
    const pos: number[] = be.Pos ?? [be.x ?? 0, be.y ?? 0, be.z ?? 0]
    const { Pos, x, y, z, ...rest } = be
    return { pos: [pos[0], pos[1], pos[2]] as [number, number, number], data: rest }
  })

  const entities = (schem.Entities ?? []).map((e: any) => {
    const pos: number[] = e.Pos ?? [0, 0, 0]
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
