import { Blueprint, BlockState, BlueprintFormat, isAir, parseBlockState, stringifyBlockState } from '../model'

interface BgOurShape {
  name?: string
  author?: string
  size: { x: number; y: number; z: number }
  palette: string[]
  blocks: { pos: [number, number, number]; state: number }[]
  dataVersion?: number
}

/**
 * Read a Building Gadgets (建筑小帮手) template `.json`.
 *
 * Supports both the clean shape produced by {@link writeBuildingGadget} and the
 * native Building Gadgets `statePosArrayList` / `mapIntState` export.
 */
export function readBuildingGadget(data: Uint8Array): Blueprint {
  const text = new TextDecoder().decode(data).trim()
  const json: any = JSON.parse(text)

  if (Array.isArray(json.palette) && Array.isArray(json.blocks)) {
    return fromOurShape(json)
  }
  if (json.statePosArrayList || json.mapIntState) {
    return fromNativeShape(json)
  }
  // Some exports wrap the payload in a `header` / `body` envelope.
  if (json.body && (json.body.statePosArrayList || json.body.mapIntState)) {
    return fromNativeShape({ ...json.header, ...json.body })
  }
  throw new Error('Unrecognized Building Gadgets template')
}

function fromOurShape(json: BgOurShape): Blueprint {
  const palette: BlockState[] = json.palette.map(parseBlockState)
  if (palette.length === 0 || palette[0].name !== 'minecraft:air') {
    palette.unshift({ name: 'minecraft:air' })
  }
  const size = json.size
  const blocks = new Uint16Array(size.x * size.y * size.z)
  for (const b of json.blocks) {
    const flat = b.pos[0] + size.x * (b.pos[2] + size.z * b.pos[1])
    if (flat >= 0 && flat < blocks.length) blocks[flat] = b.state
  }
  return {
    format: BlueprintFormat.BuildingGadget,
    name: json.name,
    author: json.author,
    dataVersion: json.dataVersion,
    size,
    palette,
    blocks,
    blockEntities: [],
    entities: [],
  }
}

function fromNativeShape(json: any): Blueprint {
  const stateList: { state: number; pos: { X: number; Y: number; Z: number } }[] = json.statePosArrayList ?? []

  const intState: BlockState[] = []
  const rawMap = json.mapIntState ?? json.mapState ?? {}
  if (Array.isArray(rawMap)) {
    for (const entry of rawMap) intState.push(nativeBlockState(entry))
  } else {
    for (const [k, v] of Object.entries(rawMap)) intState[Number(k)] = nativeBlockState(v)
  }

  let max = { x: 0, y: 0, z: 0 }
  let min = { x: Infinity, y: Infinity, z: Infinity }
  for (const s of stateList) {
    min = { x: Math.min(min.x, s.pos.X), y: Math.min(min.y, s.pos.Y), z: Math.min(min.z, s.pos.Z) }
    max = { x: Math.max(max.x, s.pos.X), y: Math.max(max.y, s.pos.Y), z: Math.max(max.z, s.pos.Z) }
  }
  if (!Number.isFinite(min.x)) min = { x: 0, y: 0, z: 0 }
  const size = { x: max.x - min.x + 1, y: max.y - min.y + 1, z: max.z - min.z + 1 }

  const combinedPalette: BlockState[] = [{ name: 'minecraft:air' }]
  const indexMap = new Map<string, number>([['minecraft:air', 0]])
  const intern = (s: BlockState) => {
    const key = stringifyBlockState(s)
    let idx = indexMap.get(key)
    if (idx === undefined) {
      idx = combinedPalette.length
      combinedPalette.push(s)
      indexMap.set(key, idx)
    }
    return idx
  }

  const blocks = new Uint16Array(size.x * size.y * size.z)
  for (const s of stateList) {
    const state = intState[s.state]
    if (!state || isAir(state)) continue
    const x = s.pos.X - min.x
    const y = s.pos.Y - min.y
    const z = s.pos.Z - min.z
    blocks[x + size.x * (z + size.z * y)] = intern(state)
  }

  return {
    format: BlueprintFormat.BuildingGadget,
    name: json.name,
    author: json.author,
    size,
    palette: combinedPalette,
    blocks,
    blockEntities: [],
    entities: [],
  }
}

function nativeBlockState(v: any): BlockState {
  if (typeof v === 'string') return parseBlockState(v)
  const name: string = v.Name ?? v.name ?? 'minecraft:air'
  const props = v.Properties ?? v.properties
  return { name, properties: props && Object.keys(props).length ? { ...props } : undefined }
}

/**
 * Write a Building Gadgets template `.json` in the clean shape.
 */
export function writeBuildingGadget(blueprint: Blueprint): Uint8Array {
  const { size, palette, blocks } = blueprint
  const out: BgOurShape = {
    name: blueprint.name,
    author: blueprint.author,
    dataVersion: blueprint.dataVersion,
    size,
    palette: palette.map(stringifyBlockState),
    blocks: [],
  }
  for (let y = 0; y < size.y; y++) {
    for (let z = 0; z < size.z; z++) {
      for (let x = 0; x < size.x; x++) {
        const flat = x + size.x * (z + size.z * y)
        const state = blocks[flat]
        if (isAir(palette[state])) continue
        out.blocks.push({ pos: [x, y, z], state })
      }
    }
  }
  return new TextEncoder().encode(JSON.stringify(out))
}
