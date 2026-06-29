import { describe, expect, test } from 'vitest'
import { join } from 'path'
import { getSaveRegions, listSaveDimensions, renderSaveRegion } from './region'

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
})
