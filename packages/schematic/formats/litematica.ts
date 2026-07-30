import { deserialize, getPrototypeOf, serialize, TagType } from '@xmcl/nbt'
import { Blueprint, BlockState, BlueprintFormat, isAir, stringifyBlockState } from '../model'
import { compoundListSchema } from '../nbtSchema'
import { packLitematicaStates, unpackLitematicaStates, withSchema } from '../nbtUtil'

interface NormalizedRegion {
  min: { x: number; y: number; z: number }
  abs: { x: number; y: number; z: number }
  palette: BlockState[]
  states: bigint[]
  tiles: any[]
  entities: any[]
}

/**
 * Read a Litematica schematic (`.litematic`). Multiple regions are merged into a
 * single combined grid.
 */
export async function readLitematic(data: Uint8Array): Promise<Blueprint> {
  const root: any = await deserialize(data, { compressed: 'gzip' })
  const meta = root.Metadata ?? {}
  const regions = root.Regions ?? {}

  const norms: NormalizedRegion[] = []
  for (const name of Object.keys(regions)) {
    const region = regions[name]
    const pos = region.Position ?? { x: 0, y: 0, z: 0 }
    const sz = region.Size ?? { x: 0, y: 0, z: 0 }
    const abs = { x: Math.abs(sz.x), y: Math.abs(sz.y), z: Math.abs(sz.z) }
    const min = {
      x: sz.x < 0 ? pos.x + sz.x + 1 : pos.x,
      y: sz.y < 0 ? pos.y + sz.y + 1 : pos.y,
      z: sz.z < 0 ? pos.z + sz.z + 1 : pos.z,
    }
    const palette: BlockState[] = (region.BlockStatePalette ?? []).map((p: any) => ({
      name: p.Name,
      properties: p.Properties && Object.keys(p.Properties).length ? { ...p.Properties } : undefined,
    }))
    norms.push({
      min,
      abs,
      palette,
      states: region.BlockStates ?? [],
      tiles: region.TileEntities ?? [],
      entities: region.Entities ?? [],
    })
  }

  if (norms.length === 0) {
    return {
      format: BlueprintFormat.Litematic,
      name: meta.Name,
      author: meta.Author,
      description: meta.Description,
      dataVersion: root.MinecraftDataVersion,
      size: { x: 0, y: 0, z: 0 },
      palette: [{ name: 'minecraft:air' }],
      blocks: new Uint16Array(0),
      blockEntities: [],
      entities: [],
    }
  }

  const gmin = { x: Infinity, y: Infinity, z: Infinity }
  const gmax = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const n of norms) {
    gmin.x = Math.min(gmin.x, n.min.x)
    gmin.y = Math.min(gmin.y, n.min.y)
    gmin.z = Math.min(gmin.z, n.min.z)
    gmax.x = Math.max(gmax.x, n.min.x + n.abs.x - 1)
    gmax.y = Math.max(gmax.y, n.min.y + n.abs.y - 1)
    gmax.z = Math.max(gmax.z, n.min.z + n.abs.z - 1)
  }
  const size = { x: gmax.x - gmin.x + 1, y: gmax.y - gmin.y + 1, z: gmax.z - gmin.z + 1 }

  const combinedPalette: BlockState[] = [{ name: 'minecraft:air' }]
  const paletteIndex = new Map<string, number>([['minecraft:air', 0]])
  const blocks = new Uint16Array(size.x * size.y * size.z)
  const blockEntities: Blueprint['blockEntities'] = []
  const entities: Blueprint['entities'] = []

  const internIndex = (state: BlockState) => {
    const key = stringifyBlockState(state)
    let idx = paletteIndex.get(key)
    if (idx === undefined) {
      idx = combinedPalette.length
      combinedPalette.push(state)
      paletteIndex.set(key, idx)
    }
    return idx
  }

  for (const n of norms) {
    const count = n.abs.x * n.abs.y * n.abs.z
    if (count === 0) continue
    const local = unpackLitematicaStates(n.states, count, n.palette.length)
    const remap = n.palette.map((s) => internIndex(s))
    for (let y = 0; y < n.abs.y; y++) {
      for (let z = 0; z < n.abs.z; z++) {
        for (let x = 0; x < n.abs.x; x++) {
          const localIndex = (y * n.abs.z + z) * n.abs.x + x
          const stateIdx = local[localIndex]
          if (stateIdx === 0) continue
          const wx = n.min.x + x - gmin.x
          const wy = n.min.y + y - gmin.y
          const wz = n.min.z + z - gmin.z
          blocks[wx + size.x * (wz + size.z * wy)] = remap[stateIdx] ?? 0
        }
      }
    }
    for (const t of n.tiles) {
      const { x, y, z, ...rest } = t
      blockEntities.push({ pos: [(x ?? 0) - gmin.x, (y ?? 0) - gmin.y, (z ?? 0) - gmin.z], data: rest })
    }
    for (const e of n.entities) {
      const p: number[] = e.Pos ?? [0, 0, 0]
      entities.push({ pos: [p[0] - gmin.x, p[1] - gmin.y, p[2] - gmin.z], data: e })
    }
  }

  return {
    format: BlueprintFormat.Litematic,
    name: meta.Name,
    author: meta.Author,
    description: meta.Description,
    dataVersion: root.MinecraftDataVersion,
    size,
    palette: combinedPalette,
    blocks,
    blockEntities,
    entities,
  }
}

/**
 * Write a Litematica schematic (`.litematic`) with a single region.
 */
export async function writeLitematic(blueprint: Blueprint): Promise<Uint8Array> {
  const { size, palette, blocks } = blueprint
  const regionName = blueprint.name || 'Unnamed'

  const paletteList = palette.map((state) => {
    const entry: any = { Name: state.name }
    if (state.properties && Object.keys(state.properties).length) {
      const props: Record<string, string> = {}
      const schema: Record<string, TagType> = {}
      for (const [k, v] of Object.entries(state.properties)) {
        props[k] = String(v)
        schema[k] = TagType.String
      }
      entry.Properties = withSchema(props, schema)
    }
    return entry
  })

  const longs = packLitematicaStates(blocks, palette.length)

  let totalBlocks = 0
  for (let i = 0; i < blocks.length; i++) {
    if (!isAir(palette[blocks[i]])) totalBlocks++
  }

  const tiles = blueprint.blockEntities.map((be) => ({
    ...be.data,
    x: be.pos[0],
    y: be.pos[1],
    z: be.pos[2],
  }))

  const sizeSchema = { x: TagType.Int, y: TagType.Int, z: TagType.Int }
  const now = BigInt(Date.now())

  const region: any = {
    Position: withSchema({ x: 0, y: 0, z: 0 }, sizeSchema),
    Size: withSchema({ x: size.x, y: size.y, z: size.z }, sizeSchema),
    BlockStatePalette: paletteList,
    BlockStates: longs,
    TileEntities: tiles,
    Entities: blueprint.entities.map((e) => e.data),
    PendingBlockTicks: [],
    PendingFluidTicks: [],
  }
  withSchema(region, {
    Position: sizeSchema,
    Size: sizeSchema,
    BlockStatePalette: compoundListSchema(paletteList),
    BlockStates: TagType.LongArray,
    TileEntities: compoundListSchema(tiles),
    Entities: compoundListSchema(blueprint.entities.map((e) => e.data)),
    PendingBlockTicks: compoundListSchema([]),
    PendingFluidTicks: compoundListSchema([]),
  })

  const metadata: any = {
    Name: blueprint.name ?? regionName,
    Author: blueprint.author ?? 'XMCL',
    Description: blueprint.description ?? '',
    EnclosingSize: withSchema({ x: size.x, y: size.y, z: size.z }, sizeSchema),
    TimeCreated: now,
    TimeModified: now,
    TotalVolume: size.x * size.y * size.z,
    TotalBlocks: totalBlocks,
    RegionCount: 1,
  }
  withSchema(metadata, {
    Name: TagType.String,
    Author: TagType.String,
    Description: TagType.String,
    EnclosingSize: sizeSchema,
    TimeCreated: TagType.Long,
    TimeModified: TagType.Long,
    TotalVolume: TagType.Int,
    TotalBlocks: TagType.Int,
    RegionCount: TagType.Int,
  })

  const regions: any = { [regionName]: region }
  // The Regions compound maps a dynamic region name to the region compound; we
  // describe it explicitly so the nested region schema is applied.
  withSchema(regions, { [regionName]: getPrototypeOf(region)! })

  const root: any = {
    MinecraftDataVersion: blueprint.dataVersion ?? 3700,
    Version: 6,
    Metadata: metadata,
    Regions: regions,
  }
  withSchema(root, {
    MinecraftDataVersion: TagType.Int,
    Version: TagType.Int,
    Metadata: getPrototypeOf(metadata)!,
    Regions: getPrototypeOf(regions)!,
  })

  return serialize(root, { compressed: 'gzip' })
}
