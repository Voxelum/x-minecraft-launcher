import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, test } from 'vitest'
import {
  LegacyRegionSectionDataFrame,
  NewRegionSectionDataFrame,
  RegionReader,
  WorldReader,
  getIndexInChunk,
} from './index'

describe('WorldReader', () => {
  test('should load level of a simple map', async ({ mock }) => {
    const world = await WorldReader.create(`${mock}/saves/sample-map`)
    const level = await world.getLevelData()
    expect(level.DataVersion).toEqual(512)
    expect(level.LevelName).toEqual('Testa')
    expect(level.Difficulty).toEqual(2)
  })
  describe('#create', () => {
    test('should load map from path', async ({ mock }) => {
      await expect(WorldReader.create(`${mock}/saves/sample-map`)).resolves.toBeTruthy()
    })
    test('should load map from zip', async ({ mock }) => {
      await expect(WorldReader.create(`${mock}/saves/sample-map.zip`)).resolves.toBeTruthy()
    })
  })
  test('#getLevelData', async ({ mock }) => {
    const reader = await WorldReader.create(`${mock}/saves/sample-map`)
    const level = await reader.getLevelData()
    expect(level.DataVersion).toEqual(512)
    expect(level.LevelName).toEqual('Testa')
    expect(level.Difficulty).toEqual(2)
  })
  test('#getPlayerData', async ({ mock }) => {
    const reader = await WorldReader.create(`${mock}/saves/sample-map`)
    const players = await reader.getPlayerData()
    expect(players).toHaveLength(1)
  })

  describe('#getRegionData', () => {
    test('should be able to get region data', async ({ mock }) => {
      const reader = await WorldReader.create(`${mock}/saves/sample-map`)
      const region = await reader.getRegionData(0, 0)
      expect(region.DataVersion).toEqual(1976) // 1628
      expect(region.Level.Entities).toBeInstanceOf(Array)
      expect(region.Level.Sections).toBeInstanceOf(Array)
    })
    test('should be able to get the correct section', async ({ mock }) => {
      const reader = await WorldReader.create(`${mock}/saves/1.12.2`)
      const region = await reader.getRegionData(0, 0)
      const section = region.Level.Sections[0] as LegacyRegionSectionDataFrame
      // the blocks is the string format of nbt data in the `Block` section
      const blocks = readFileSync(join(mock, 'saves/1.12.2/block.txt'))
        .toString()
        .split(' ')
        .map((s) => s.trim())
        .filter((s) => s.length !== 0)
        .map((s) => Number.parseInt(s))
      // the data is the string format of nbt data in `Data` section
      const data = readFileSync(join(mock, 'saves/1.12.2/data.txt'))
        .toString()
        .split(' ')
        .map((s) => s.trim())
        .filter((s) => s.length !== 0)
        .map((s) => Number.parseInt(s))

      // If they equal, then we correctly found the section
      expect(section.Blocks).toEqual(blocks)
      expect(section.Data).toEqual(data)
    })
  })
})

describe('RegionReader', () => {
  /**
   * Convert Minecraft BlockState toString() result to object format.
   */
  function nameToBlockState(name: string) {
    const patt = /Block\{(.+)\}(\[(.+)\])?/g
    const mat = patt.exec(name)!
    const result: any = {
      Name: mat[1]!,
    }
    if (mat[2]!) {
      result.Properties = {}
      const s = mat[2].substring(1, mat[2]!.length - 1)!
      s.split(',')
        .map((s) => s.split('='))
        .forEach(([key, value]) => {
          result.Properties[key] = value
        })
    }
    return result
  }

  function getMockData(mock: string, version: string) {
    const expected: Record<number, { name: string; id: number }> = {}
    readFileSync(`${mock}/saves/${version}/mock.txt`)
      .toString()
      .split('\n')
      .map((l) => l.split(' '))
      .forEach(([id, x, y, z, name]) => {
        if (typeof x === 'undefined') {
          return
        }
        const i = getIndexInChunk(Number.parseInt(x), Number.parseInt(y), Number.parseInt(z))
        expected[i] = { name, id: Number.parseInt(id) }
      })
    return expected
  }

  // The mock data contains the expected blockstate id, x, y, z, blockstate info
  // which is dump from mod
  // For the dump script, please see these gist
  // 1.14.4: https://gist.github.com/ci010/27415d55a3e72399924433b759924f2e
  // 1.12.2 https://gist.github.com/ci010/9032360a9137c8f8c37c0b07a93b3ee6

  describe('#seekBlockStateId', () => {
    test.skip('should be able to seek 1.12.2 (legacy) version chunk', async ({ mock }) => {
      const mockData = getMockData(mock, '1.14.4')
      const reader = await WorldReader.create(`${mock}/saves/1.12.2`)
      const region = await reader.getRegionData(0, 0)
      const chunkY = 0
      const section = RegionReader.getSection(region, chunkY)

      // compare the seeked id with the expect id
      // 1.12.2 mock data record the global blockstate id, and the chunk also save global blockstate id
      // therefore we can directly compare them here
      for (let x = 0; x < 16; x += 2) {
        for (let y = 0; y < 16; y += 2) {
          for (let z = 0; z < 16; z += 2) {
            const i = getIndexInChunk(x, y, z)
            const id = RegionReader.seekBlockStateId(section, i)
            const expected = mockData[i]
            if (typeof expected === 'undefined') {
              continue
            }
            expect(id).toEqual(expected.id)
          }
        }
      }
    })
    test.skip('should be able to seek 1.14.4 chunk', async ({ mock }) => {
      const reader = await WorldReader.create(`${mock}/saves/1.14.4`)
      const region = await reader.getRegionData(0, 0)
      const chunkY = 0
      const section = RegionReader.getSection(region, chunkY) as NewRegionSectionDataFrame
      const mockData = getMockData(mock, '1.14.4')

      // 1.14.4, chunk save local blockstate id, we need to convert them to blockstate string
      // by Palette (the map from id to blockstate)
      // then we can compare the blockstate object
      for (let x = 0; x < 16; x += 2) {
        for (let y = 0; y < 16; y += 2) {
          for (let z = 0; z < 16; z += 2) {
            const i = getIndexInChunk(x, y, z)
            const id = RegionReader.seekBlockStateId(section, i)
            const expected = mockData[i]
            if (typeof expected === 'undefined') {
              continue
            }
            const actualObject = section.Palette![id]
            const expectedObject = nameToBlockState(expected.name.trim())
            expect(actualObject).toEqual(expectedObject)
          }
        }
      }
    })
    test('should be able to seek 1.16.4 chunk', async ({ mock }) => {
      const reader = await WorldReader.create(`${mock}/saves/1.16.4`)
      const region = await reader.getRegionData(0, 0)
      const chunkY = 0
      const section = RegionReader.getSection(region, chunkY) as NewRegionSectionDataFrame
      const mockData = getMockData(mock, '1.16.4')

      // 1.14.4, chunk save local blockstate id, we need to convert them to blockstate string
      // by Palette (the map from id to blockstate)
      // then we can compare the blockstate object
      for (let x = 0; x < 16; x += 2) {
        for (let y = 0; y < 16; y += 2) {
          for (let z = 0; z < 16; z += 2) {
            const i = getIndexInChunk(x, y, z)
            const id = RegionReader.seekBlockStateId(section, i)
            const expected = mockData[i]
            if (typeof expected === 'undefined') {
              continue
            }
            const actualObject = section.Palette![id]
            const expectedObject = nameToBlockState(expected.name.trim())
            expect(actualObject).toEqual(expectedObject)
          }
        }
      }
    })
  })
  describe('#seekBlockState', () => {
    test.skip('should be able to get block state from 1.14.4 chunk mca', async ({ mock }) => {
      const mockData = getMockData(mock, '1.14.4')
      const reader = await WorldReader.create(`${mock}/saves/1.14.4`)
      const region = await reader.getRegionData(0, 0)
      const chunkY = 0
      const section = RegionReader.getSection(region, chunkY) as NewRegionSectionDataFrame

      for (let x = 0; x < 16; x += 2) {
        for (let y = 0; y < 16; y += 2) {
          for (let z = 0; z < 16; z += 2) {
            const i = getIndexInChunk(x, y, z)
            const state = RegionReader.seekBlockState(section, i)
            const expected = mockData[i]
            if (typeof expected === 'undefined') {
              continue
            }
            const actualObject = state
            const expectedObject = nameToBlockState(expected.name.trim())
            expect(actualObject).toEqual(expectedObject)
          }
        }
      }
    })
  })
  describe('#readBlockState', () => {
    test.skip('should be able to read 1.14.4 format', async ({ mock }) => {
      const mockData = getMockData(mock, '1.14.4')
      const reader = await WorldReader.create(`${mock}/saves/1.14.4`)
      const region = await reader.getRegionData(0, 0)
      const chunkY = 0
      const section = RegionReader.getSection(region, chunkY) as NewRegionSectionDataFrame

      RegionReader.walkBlockStateId(section, (x, y, z, id) => {
        const i = getIndexInChunk(x, y, z)
        const expectedName = mockData[i]?.name
        if (typeof expectedName === 'undefined') {
          return
        }
        const actualObject = section.Palette![id]
        const expectedObject = nameToBlockState(expectedName.trim())
        expect(actualObject).toEqual(expectedObject)
      })
    })
    test('should be able to read 1.12.2 chunk format', async ({ mock }) => {
      const mockData = getMockData(mock, '1.12.2')
      const reader = await WorldReader.create(`${mock}/saves/1.12.2`)
      const region = await reader.getRegionData(0, 0)
      const chunkY = 0
      const section = RegionReader.getSection(region, chunkY) as LegacyRegionSectionDataFrame

      RegionReader.walkBlockStateId(section, (x, y, z, id) => {
        const i = getIndexInChunk(x, y, z)
        const expectedId = mockData[i]?.id
        if (typeof expectedId === 'undefined') {
          return
        }
        expect(id).toEqual(expectedId)
      })
    })
  })
})
