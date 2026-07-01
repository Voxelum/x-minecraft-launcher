import { describe, expect, test } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'fs-extra'
import { getSaveRegions, listSaveDimensions, readSaveChunks, relocateSaveChunks, renderSaveRegion, writeSaveChunks } from './region'

const mockRoot = join(__dirname, '..', '..', 'mock', 'saves')

describe('region', () => {
  test('listSaveDimensions finds overworld', async () => {
    const dims = await listSaveDimensions(join(mockRoot, '1.19.3'))
    expect(dims).toContain('minecraft:overworld')
  })

  test('getSaveRegions lists r.0.0', async () => {
    const regions = await getSaveRegions(join(mockRoot, '1.19.3'), 'minecraft:overworld')
    expect(regions).toContainEqual({ regionX: 0, regionZ: 0 })
  })

  test.each(['1.16.5', '1.19.3'])('renderSaveRegion produces non-empty image for %s', async (version) => {
    const result = await renderSaveRegion(join(mockRoot, version), 'minecraft:overworld', 0, 0)
    expect(result.data.length).toBe(512 * 512 * 4)
    // At least one chunk should exist.
    expect(result.chunks.some(Boolean)).toBe(true)
    // At least one pixel should be opaque (rendered surface).
    let opaque = 0
    for (let i = 3; i < result.data.length; i += 4) {
      if (result.data[i] === 255) opaque++
    }
    expect(opaque).toBeGreaterThan(0)
  })

  test('readSaveChunks / writeSaveChunks round-trips chunk data', async () => {
    const src = join(mockRoot, '1.19.3')
    // Find which chunks actually exist in region (0,0).
    const rendered = await renderSaveRegion(src, 'minecraft:overworld', 0, 0)
    const existing: Array<{ chunkX: number; chunkZ: number }> = []
    for (let i = 0; i < rendered.chunks.length; i++) {
      if (rendered.chunks[i]) {
        existing.push({ chunkX: i % 32, chunkZ: Math.floor(i / 32) })
      }
    }
    expect(existing.length).toBeGreaterThan(0)

    const copied = await readSaveChunks(src, 'minecraft:overworld', existing)
    expect(copied.length).toBe(existing.length)

    const dest = await mkdtemp(join(tmpdir(), 'xmcl-chunks-'))
    try {
      await writeSaveChunks(dest, 'minecraft:overworld', copied)
      const readBack = await readSaveChunks(dest, 'minecraft:overworld', existing)
      expect(readBack.length).toBe(copied.length)
      // The compressed payloads should be byte-identical after a round-trip.
      const byKey = new Map(readBack.map((c) => [`${c.chunkX},${c.chunkZ}`, c]))
      for (const original of copied) {
        const back = byKey.get(`${original.chunkX},${original.chunkZ}`)
        expect(back).toBeDefined()
        expect(back!.compression).toBe(original.compression)
        expect(Buffer.from(back!.data)).toEqual(Buffer.from(original.data))
      }
      // The pasted region must render to a non-empty image.
      const pasted = await renderSaveRegion(dest, 'minecraft:overworld', 0, 0)
      expect(pasted.chunks.some(Boolean)).toBe(true)
    } finally {
      await rm(dest, { recursive: true, force: true })
    }
  })

  test('relocateSaveChunks moves chunks and keeps them renderable', async () => {
    const src = join(mockRoot, '1.19.3')
    const rendered = await renderSaveRegion(src, 'minecraft:overworld', 0, 0)
    const existing: Array<{ chunkX: number; chunkZ: number }> = []
    for (let i = 0; i < rendered.chunks.length; i++) {
      if (rendered.chunks[i]) {
        existing.push({ chunkX: i % 32, chunkZ: Math.floor(i / 32) })
      }
    }
    const copied = await readSaveChunks(src, 'minecraft:overworld', existing)
    expect(copied.length).toBeGreaterThan(0)

    // Shift by 100 chunks on both axes -> lands in region (3,3).
    const relocated = relocateSaveChunks(copied, 100, 100)
    expect(relocated.length).toBe(copied.length)
    for (let i = 0; i < copied.length; i++) {
      expect(relocated[i].chunkX).toBe(copied[i].chunkX + 100)
      expect(relocated[i].chunkZ).toBe(copied[i].chunkZ + 100)
    }
    // A zero offset must be a no-op that returns the same array reference.
    expect(relocateSaveChunks(copied, 0, 0)).toBe(copied)

    const dest = await mkdtemp(join(tmpdir(), 'xmcl-relocate-'))
    try {
      await writeSaveChunks(dest, 'minecraft:overworld', relocated)
      // The chunks now live in region (3,3) and must still render.
      const moved = await renderSaveRegion(dest, 'minecraft:overworld', 3, 3)
      expect(moved.chunks.some(Boolean)).toBe(true)
      // Nothing should have been written to the original region.
      const origin = await renderSaveRegion(dest, 'minecraft:overworld', 0, 0)
      expect(origin.chunks.some(Boolean)).toBe(false)
    } finally {
      await rm(dest, { recursive: true, force: true })
    }
  })
})
