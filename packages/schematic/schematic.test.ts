import { describe, expect, it } from 'vitest'
import { Blueprint, BlueprintFormat } from './model'
import { readSponge, writeSponge } from './formats/sponge'
import { readLitematic, writeLitematic } from './formats/litematica'
import { readStructure, writeStructure } from './formats/structure'
import { readBuildingGadget, writeBuildingGadget } from './formats/buildingGadget'
import { getMaterialList } from './material'
import { replaceBlocks, ReplaceMode } from './replace'

function sample(): Blueprint {
  // 2x2x2 with a couple of distinct blocks
  const size = { x: 2, y: 2, z: 2 }
  const palette = [
    { name: 'minecraft:air' },
    { name: 'minecraft:stone' },
    { name: 'minecraft:oak_log', properties: { axis: 'y' } },
  ]
  const blocks = new Uint16Array(8)
  blocks[0] = 1 // (0,0,0) stone
  blocks[1] = 1 // (1,0,0) stone
  blocks[2] = 2 // (0,0,1) log
  blocks[7] = 2 // (1,1,1) log
  return {
    format: BlueprintFormat.Schem,
    name: 'sample',
    author: 'tester',
    dataVersion: 3700,
    size,
    palette,
    blocks,
    blockEntities: [],
    entities: [],
  }
}

function expectSameVolume(a: Blueprint, b: Blueprint) {
  expect(b.size).toEqual(a.size)
  for (let i = 0; i < a.blocks.length; i++) {
    const an = a.palette[a.blocks[i]].name
    const bn = b.palette[b.blocks[i]].name
    expect(bn).toBe(an)
  }
}

describe('sponge round-trip', () => {
  it('preserves blocks', async () => {
    const bp = sample()
    const data = await writeSponge(bp)
    const back = await readSponge(data)
    expectSameVolume(bp, back)
  })
})

describe('litematica round-trip', () => {
  it('preserves blocks', async () => {
    const bp = sample()
    const data = await writeLitematic(bp)
    const back = await readLitematic(data)
    expectSameVolume(bp, back)
  })
})

describe('structure round-trip', () => {
  it('preserves blocks', async () => {
    const bp = sample()
    const data = await writeStructure(bp)
    const back = await readStructure(data)
    expectSameVolume(bp, back)
  })
})

describe('building gadget round-trip', () => {
  it('preserves blocks', () => {
    const bp = sample()
    const data = writeBuildingGadget(bp)
    const back = readBuildingGadget(data)
    expectSameVolume(bp, back)
  })
})

describe('material list', () => {
  it('counts non-air blocks', () => {
    const list = getMaterialList(sample())
    const stone = list.find((m) => m.block === 'minecraft:stone')
    const log = list.find((m) => m.block === 'minecraft:oak_log')
    expect(stone?.count).toBe(2)
    expect(log?.count).toBe(2)
  })
})

describe('block replacement', () => {
  it('simple mode keeps properties', () => {
    const bp = sample()
    const affected = replaceBlocks(bp, [{ from: 'minecraft:oak_log', to: 'minecraft:birch_log' }], ReplaceMode.Simple)
    expect(affected).toBe(2)
    const birch = bp.palette.find((s) => s.name === 'minecraft:birch_log')
    expect(birch?.properties?.axis).toBe('y')
  })
})
