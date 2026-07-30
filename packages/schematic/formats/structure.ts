import { deserialize, serialize, TagType } from '@xmcl/nbt'
import { Blueprint, BlockState, BlueprintFormat, isAir, stringifyBlockState } from '../model'
import { compoundListSchema } from '../nbtSchema'
import { withSchema } from '../nbtUtil'

/**
 * Read a vanilla structure block file (`.nbt`).
 */
export async function readStructure(data: Uint8Array): Promise<Blueprint> {
  const root: any = await deserialize(data, { compressed: 'gzip' })
  const sizeArr: number[] = root.size ?? [0, 0, 0]
  const size = { x: sizeArr[0], y: sizeArr[1], z: sizeArr[2] }

  const structurePalette: BlockState[] = (root.palette ?? []).map((p: any) => ({
    name: p.Name,
    properties: p.Properties && Object.keys(p.Properties).length ? { ...p.Properties } : undefined,
  }))

  const combinedPalette: BlockState[] = [{ name: 'minecraft:air' }]
  const blocks = new Uint16Array(size.x * size.y * size.z)
  const blockEntities: Blueprint['blockEntities'] = []

  for (const block of root.blocks ?? []) {
    const pos: number[] = block.pos ?? [0, 0, 0]
    const state = structurePalette[block.state]
    if (!state) continue
    let idx = combinedPalette.findIndex((s) => stringifyBlockState(s) === stringifyBlockState(state))
    if (idx === -1) {
      idx = combinedPalette.length
      combinedPalette.push(state)
    }
    const flat = pos[0] + size.x * (pos[2] + size.z * pos[1])
    if (flat >= 0 && flat < blocks.length) blocks[flat] = idx
    if (block.nbt) {
      blockEntities.push({ pos: [pos[0], pos[1], pos[2]], data: block.nbt })
    }
  }

  const entities = (root.entities ?? []).map((e: any) => {
    const pos: number[] = e.blockPos ?? [0, 0, 0]
    return { pos: [pos[0], pos[1], pos[2]] as [number, number, number], data: e.nbt ?? e }
  })

  return {
    format: BlueprintFormat.Structure,
    name: root.author,
    author: root.author,
    dataVersion: root.DataVersion,
    size,
    palette: combinedPalette,
    blocks,
    blockEntities,
    entities,
  }
}

/**
 * Write a vanilla structure block file (`.nbt`).
 */
export async function writeStructure(blueprint: Blueprint): Promise<Uint8Array> {
  const { size, palette, blocks } = blueprint

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

  const blockEntityMap = new Map<number, Record<string, any>>()
  for (const be of blueprint.blockEntities) {
    blockEntityMap.set(be.pos[0] + size.x * (be.pos[2] + size.z * be.pos[1]), be.data)
  }

  const blockList: any[] = []
  for (let y = 0; y < size.y; y++) {
    for (let z = 0; z < size.z; z++) {
      for (let x = 0; x < size.x; x++) {
        const flat = x + size.x * (z + size.z * y)
        const state = blocks[flat]
        if (isAir(palette[state])) continue
        const block: any = {
          pos: withSchema([x, y, z], [TagType.Int]),
          state,
        }
        const be = blockEntityMap.get(flat)
        if (be) block.nbt = be
        blockList.push(block)
      }
    }
  }

  const root: any = {
    size: withSchema([size.x, size.y, size.z], [TagType.Int]),
    palette: paletteList,
    blocks: blockList,
    entities: blueprint.entities.map((e) => e.data),
    DataVersion: blueprint.dataVersion ?? 3700,
  }
  withSchema(root, {
    size: [TagType.Int],
    palette: compoundListSchema(paletteList),
    blocks: compoundListSchema(blockList),
    entities: compoundListSchema(blueprint.entities.map((e) => e.data)),
    DataVersion: TagType.Int,
  })

  return serialize(root, { compressed: 'gzip' })
}
