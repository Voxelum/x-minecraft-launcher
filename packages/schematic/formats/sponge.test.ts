import { serialize, TagType } from '@xmcl/nbt'
import { describe, expect, it } from 'vitest'
import { withSchema } from '../nbtUtil'
import { readBlueprint } from '../read'
import { readSponge } from './sponge'

async function fixture(version = 2, change: (root: any) => void = () => {}) {
  const palette = withSchema({ 'minecraft:stone': 0 }, { 'minecraft:stone': TagType.Int })
  const blocks = withSchema({ Palette: palette, Data: [0] }, { Palette: { 'minecraft:stone': TagType.Int }, Data: TagType.ByteArray })
  const root: any = { Version: version, Width: 1, Height: 1, Length: 1, Palette: palette, BlockData: [0], Blocks: blocks }
  const schema: any = { Version: TagType.Int, Width: TagType.Short, Height: TagType.Short, Length: TagType.Short,
    Palette: { 'minecraft:stone': TagType.Int }, BlockData: TagType.ByteArray, Blocks: { Palette: { 'minecraft:stone': TagType.Int }, Data: TagType.ByteArray } }
  change(root)
  if (root.Palette) {
    schema.Palette = Object.fromEntries(Object.keys(root.Palette).map((key) => [key, TagType.Int]))
    root.Palette = withSchema({ ...root.Palette }, schema.Palette)
  }
  // Match actual v3 nesting and v1/2 root layout.
  if (version === 3) return serialize(withSchema({ Schematic: withSchema(root, schema) }, { Schematic: schema }), { compressed: 'gzip' })
  delete root.Blocks
  return serialize(withSchema(root, schema), { compressed: 'gzip' })
}

describe('Sponge input validation', () => {
  it.each([1, 2, 3])('reads version %i without dropping block states', async (version) => {
    const result = await readSponge(await fixture(version))
    expect(result.palette[result.blocks[0]].name).toBe('minecraft:stone')
    expect(result.blocks).toHaveLength(1)
  })
  it('preserves Sponge v1 TileEntities', async () => {
    const tileSchema = { Pos: TagType.IntArray, Id: TagType.String }
    const root = withSchema({
      Version: 1, Width: 1, Height: 1, Length: 1,
      Palette: withSchema({ 'minecraft:chest': 0 }, { 'minecraft:chest': TagType.Int }),
      BlockData: [0], TileEntities: [withSchema({ Pos: [0, 0, 0], Id: 'minecraft:chest' }, tileSchema)],
    }, {
      Version: TagType.Int, Width: TagType.Short, Height: TagType.Short, Length: TagType.Short,
      Palette: { 'minecraft:chest': TagType.Int }, BlockData: TagType.ByteArray,
      TileEntities: [tileSchema],
    })
    const result = await readSponge(await serialize(root, { compressed: 'gzip' }))
    expect(result.blockEntities).toEqual([{ pos: [0, 0, 0], data: { Id: 'minecraft:chest' } }])
  })
  it('rejects missing palette with a useful error rather than Object.entries TypeError', async () => {
    await expect(readSponge(await fixture(2, (r) => { delete r.Palette }))).rejects.toThrow('missing Palette')
  })
  it('rejects missing v3 Blocks instead of interpreting it as v2', async () => {
    await expect(readSponge(await fixture(3, (r) => { delete r.Blocks }))).rejects.toThrow('missing Blocks')
  })
  it.each([0, 4])('rejects unsupported version %i', async (v) => {
    await expect(readSponge(await fixture(v))).rejects.toThrow('Version')
  })
  it.each([
    ['empty palette', (r: any) => { r.Palette = {} }],
    ['duplicate palette ID', (r: any) => { r.Palette['minecraft:air'] = 0 }],
    ['zero dimension', (r: any) => { r.Width = 0 }],
    ['oversized volume', (r: any) => { r.Width = r.Height = r.Length = 32767 }],
    ['missing data', (r: any) => { delete r.BlockData }],
    ['truncated varint', (r: any) => { r.BlockData = [128] }],
    ['unknown state', (r: any) => { r.BlockData = [1] }],
    ['too few blocks', (r: any) => { r.Width = 2 }],
    ['too many blocks', (r: any) => { r.BlockData = [0, 0] }],
    ['oversized palette ID', (r: any) => { r.Palette['minecraft:stone'] = 2147483647 }],
    ['negative palette ID', (r: any) => { r.Palette['minecraft:stone'] = -1 }],
  ])('rejects %s', async (_, change) => {
    await expect(readSponge(await fixture(2, change))).rejects.toThrow('Invalid or unsupported Sponge schematic')
  })
  it('preserves a valid sparse palette ID at the Uint16 boundary', async () => {
    const result = await readSponge(await fixture(2, (r) => {
      r.Palette['minecraft:stone'] = 65535
      r.BlockData = [255, 255, 3]
    }))
    expect(result.blocks[0]).toBe(65535)
    expect(result.palette[result.blocks[0]].name).toBe('minecraft:stone')
  })
  it('does not claim legacy MCEdit .schematic import succeeded', async () => {
    const data = await serialize(withSchema({ Materials: 'Alpha', Blocks: [1] }, { Materials: TagType.String, Blocks: TagType.ByteArray }), { compressed: 'gzip' })
    await expect(readBlueprint(data, 'legacy.schematic')).rejects.toThrow('MCEdit')
  })
})
