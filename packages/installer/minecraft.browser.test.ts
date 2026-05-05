import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getVersionList,
  MinecraftVersionList,
  MinecraftVersion,
  MinecraftVersionBaseInfo,
  DEFAULT_VERSION_MANIFEST_URL,
} from './minecraft.browser'

describe('minecraft.browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getVersionList', () => {
    test('should fetch version list with default URL', async () => {
      const mockVersions: MinecraftVersion[] = [
        {
          id: '1.20.1',
          type: 'release',
          url: 'https://example.com/1.20.1.json',
          time: '2023-06-12T08:00:00+00:00',
          releaseTime: '2023-06-12T08:00:00+00:00',
        },
        {
          id: '1.19.4',
          type: 'release',
          url: 'https://example.com/1.19.4.json',
          time: '2023-03-14T12:00:00+00:00',
          releaseTime: '2023-03-14T12:00:00+00:00',
        },
      ]
      const mockManifest: MinecraftVersionList = {
        latest: {
          release: '1.20.1',
          snapshot: '23w31a',
        },
        versions: mockVersions,
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getVersionList({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://launchermeta.mojang.com/mc/game/version_manifest.json',
        expect.any(Object),
      )
      expect(result).toEqual(mockManifest)
      expect(result.versions).toHaveLength(2)
      expect(result.latest.release).toBe('1.20.1')
    })

    test('should use custom remote URL', async () => {
      const customUrl = 'https://custom.example.com/manifest.json'
      const mockManifest: MinecraftVersionList = {
        latest: { release: '1.20.1', snapshot: '23w31a' },
        versions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      await getVersionList({
        fetch: mockFetch,
        remote: customUrl,
      })

      expect(mockFetch).toHaveBeenCalledWith(customUrl, expect.any(Object))
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({ latest: { release: '', snapshot: '' }, versions: [] }),
      })

      await getVersionList({
        fetch: mockFetch,
        signal: controller.signal,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    test('should work without options', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => ({ latest: { release: '', snapshot: '' }, versions: [] }),
      } as any)

      const result = await getVersionList()

      expect(result).toHaveProperty('latest')
      expect(result).toHaveProperty('versions')
      mockFetch.mockRestore()
    })

    test('should handle empty version list', async () => {
      const mockManifest: MinecraftVersionList = {
        latest: { release: '1.20.1', snapshot: '23w31a' },
        versions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getVersionList({ fetch: mockFetch })

      expect(result.versions).toEqual([])
      expect(result.latest).toEqual({ release: '1.20.1', snapshot: '23w31a' })
    })

    test('should handle different version types', async () => {
      const versions: MinecraftVersion[] = [
        {
          id: '1.20.1',
          type: 'release',
          url: 'https://example.com/1.20.1.json',
          time: '2023-06-12T08:00:00+00:00',
          releaseTime: '2023-06-12T08:00:00+00:00',
        },
        {
          id: '23w31a',
          type: 'snapshot',
          url: 'https://example.com/23w31a.json',
          time: '2023-08-01T08:00:00+00:00',
          releaseTime: '2023-08-01T08:00:00+00:00',
        },
        {
          id: '1.19.4-pre1',
          type: 'pending',
          url: 'https://example.com/1.19.4-pre1.json',
          time: '2023-02-01T08:00:00+00:00',
          releaseTime: '2023-02-01T08:00:00+00:00',
        },
      ]
      const mockManifest: MinecraftVersionList = {
        latest: { release: '1.20.1', snapshot: '23w31a' },
        versions,
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getVersionList({ fetch: mockFetch })

      expect(result.versions).toHaveLength(3)
      expect(result.versions.map((v) => v.type)).toContain('release')
      expect(result.versions.map((v) => v.type)).toContain('snapshot')
      expect(result.versions.map((v) => v.type)).toContain('pending')
    })
  })

  describe('DEFAULT_VERSION_MANIFEST_URL', () => {
    test('should have correct default URL', () => {
      expect(DEFAULT_VERSION_MANIFEST_URL).toBe(
        'https://launchermeta.mojang.com/mc/game/version_manifest.json',
      )
    })
  })

  describe('MinecraftVersion interface', () => {
    test('should have required properties', () => {
      const version: MinecraftVersion = {
        id: '1.20.1',
        type: 'release',
        url: 'https://example.com/1.20.1.json',
        time: '2023-06-12T08:00:00+00:00',
        releaseTime: '2023-06-12T08:00:00+00:00',
      }

      expect(version.id).toBe('1.20.1')
      expect(version.type).toBe('release')
      expect(version.url).toBe('https://example.com/1.20.1.json')
      expect(version.time).toBe('2023-06-12T08:00:00+00:00')
      expect(version.releaseTime).toBe('2023-06-12T08:00:00+00:00')
    })

    test('should support different release types', () => {
      const types = ['release', 'snapshot', 'old_alpha', 'old_beta', 'pending']

      types.forEach((type) => {
        const version: MinecraftVersion = {
          id: 'test',
          type,
          url: 'https://example.com/test.json',
          time: '2023-01-01T00:00:00+00:00',
          releaseTime: '2023-01-01T00:00:00+00:00',
        }

        expect(version.type).toBe(type)
      })
    })
  })

  describe('MinecraftVersionList interface', () => {
    test('should have latest and versions properties', () => {
      const manifest: MinecraftVersionList = {
        latest: {
          release: '1.20.1',
          snapshot: '23w31a',
        },
        versions: [
          {
            id: '1.20.1',
            type: 'release',
            url: 'https://example.com/1.20.1.json',
            time: '2023-06-12T08:00:00+00:00',
            releaseTime: '2023-06-12T08:00:00+00:00',
          },
        ],
      }

      expect(manifest.latest.release).toBe('1.20.1')
      expect(manifest.latest.snapshot).toBe('23w31a')
      expect(manifest.versions).toHaveLength(1)
    })
  })

  describe('MinecraftVersionBaseInfo interface', () => {
    test('should have basic version info properties', () => {
      const info: MinecraftVersionBaseInfo = {
        id: '1.20.1',
        url: 'https://example.com/1.20.1.json',
      }

      expect(info.id).toBe('1.20.1')
      expect(info.url).toBe('https://example.com/1.20.1.json')
    })
  })
})
