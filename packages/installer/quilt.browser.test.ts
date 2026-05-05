import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getQuiltGames,
  getQuiltLoaders,
  getQuiltLoaderVersionsByMinecraft,
  QuiltLoaderArtifact,
  GetQuiltOptions,
  DEFAULT_META_URL_QUILT,
} from './quilt.browser'
import { FabricArtifactVersion } from './fabric.browser'

describe('quilt.browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getQuiltGames', () => {
    test('should fetch quilt game versions', async () => {
      const mockGames = [{ version: '1.20.1' }, { version: '1.19.4' }, { version: '23w31a' }]
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockGames,
      })

      const result = await getQuiltGames({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith('https://meta.quiltmc.org/v3/game', expect.any(Object))
      expect(result).toEqual(['1.20.1', '1.19.4', '23w31a'])
      expect(result).toHaveLength(3)
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      await getQuiltGames({
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
        json: async () => [],
      } as any)

      const result = await getQuiltGames()

      expect(result).toEqual([])
      mockFetch.mockRestore()
    })

    test('should handle empty game list', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      const result = await getQuiltGames({ fetch: mockFetch })

      expect(result).toEqual([])
    })

    test('should extract version strings from response', async () => {
      const mockGames = [{ version: '1.20.1' }, { version: '1.19.4' }, { version: '1.18.2' }]
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockGames,
      })

      const result = await getQuiltGames({ fetch: mockFetch })

      expect(result).toEqual(['1.20.1', '1.19.4', '1.18.2'])
    })
  })

  describe('getQuiltLoaders', () => {
    test('should fetch quilt loader versions', async () => {
      const mockLoaders: FabricArtifactVersion[] = [
        { version: '0.19.2', maven: 'org.quiltmc:quilt-loader:0.19.2', stable: true },
        { version: '0.19.1', maven: 'org.quiltmc:quilt-loader:0.19.1', stable: true },
        {
          version: '0.19.0-beta.1',
          maven: 'org.quiltmc:quilt-loader:0.19.0-beta.1',
          stable: false,
        },
      ]
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockLoaders,
      })

      const result = await getQuiltLoaders({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://meta.quiltmc.org/v3/versions/loader',
        expect.any(Object),
      )
      expect(result).toEqual(mockLoaders)
      expect(result).toHaveLength(3)
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      await getQuiltLoaders({
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
        json: async () => [],
      } as any)

      const result = await getQuiltLoaders()

      expect(result).toEqual([])
      mockFetch.mockRestore()
    })

    test('should handle empty loader list', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      const result = await getQuiltLoaders({ fetch: mockFetch })

      expect(result).toEqual([])
    })

    test('should differentiate stable and beta versions', async () => {
      const mockLoaders: FabricArtifactVersion[] = [
        { version: '0.19.2', maven: 'org.quiltmc:quilt-loader:0.19.2', stable: true },
        {
          version: '0.19.0-beta.1',
          maven: 'org.quiltmc:quilt-loader:0.19.0-beta.1',
          stable: false,
        },
      ]
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockLoaders,
      })

      const result = await getQuiltLoaders({ fetch: mockFetch })

      expect(result.filter((l) => l.stable)).toHaveLength(1)
      expect(result.filter((l) => !l.stable)).toHaveLength(1)
    })
  })

  describe('getQuiltLoaderVersionsByMinecraft', () => {
    test('should fetch quilt loader versions for specific minecraft version', async () => {
      const mockVersions: QuiltLoaderArtifact[] = [
        {
          loader: {
            separator: '.',
            build: 2,
            maven: 'org.quiltmc:quilt-loader:0.19.2',
            version: '0.19.2',
            stable: true,
          },
          intermediary: {
            maven: 'org.quiltmc:intermediary:1.20.1',
            version: '1.20.1',
            stable: true,
          },
          launcherMeta: {
            version: 1,
            libraries: {
              client: [],
              common: [],
              server: [],
            },
            mainClass: {
              client: 'net.fabricmc.loader.launch.knot.KnotClient',
              server: 'net.fabricmc.loader.launch.knot.KnotServer',
            },
          },
          hashed: {
            maven: 'org.quiltmc:hashed:1.20.1',
            version: '1.20.1',
            stable: true,
          },
        },
      ]
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockVersions,
      })

      const result = await getQuiltLoaderVersionsByMinecraft({
        fetch: mockFetch,
        minecraftVersion: '1.20.1',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://meta.quiltmc.org/v3/versions/loader/1.20.1',
        expect.any(Object),
      )
      expect(result).toEqual(mockVersions)
      expect(result).toHaveLength(1)
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      await getQuiltLoaderVersionsByMinecraft({
        fetch: mockFetch,
        signal: controller.signal,
        minecraftVersion: '1.20.1',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    test('should handle different minecraft versions', async () => {
      const versions = ['1.20.1', '1.19.4', '1.18.2', '1.16.5']
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      for (const version of versions) {
        await getQuiltLoaderVersionsByMinecraft({
          fetch: mockFetch,
          minecraftVersion: version,
        })

        expect(mockFetch).toHaveBeenCalledWith(
          `https://meta.quiltmc.org/v3/versions/loader/${version}`,
          expect.any(Object),
        )
      }
    })

    test('should handle empty loader list for minecraft version', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      const result = await getQuiltLoaderVersionsByMinecraft({
        fetch: mockFetch,
        minecraftVersion: '1.20.1',
      })

      expect(result).toEqual([])
    })

    test('should handle snapshot versions', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      await getQuiltLoaderVersionsByMinecraft({
        fetch: mockFetch,
        minecraftVersion: '23w31a',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://meta.quiltmc.org/v3/versions/loader/23w31a',
        expect.any(Object),
      )
    })

    test('should parse artifact versions correctly', async () => {
      const mockVersions: QuiltLoaderArtifact[] = [
        {
          loader: {
            separator: '.',
            build: 2,
            maven: 'org.quiltmc:quilt-loader:0.19.2',
            version: '0.19.2',
            stable: true,
          },
          intermediary: {
            maven: 'org.quiltmc:intermediary:1.20.1',
            version: '1.20.1',
            stable: true,
          },
          launcherMeta: {
            version: 1,
            libraries: {
              client: [],
              common: [],
              server: [],
            },
            mainClass: {
              client: 'net.fabricmc.loader.launch.knot.KnotClient',
              server: 'net.fabricmc.loader.launch.knot.KnotServer',
            },
          },
          hashed: {
            maven: 'org.quiltmc:hashed:1.20.1',
            version: '1.20.1',
            stable: true,
          },
        },
      ]
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockVersions,
      })

      const result = await getQuiltLoaderVersionsByMinecraft({
        fetch: mockFetch,
        minecraftVersion: '1.20.1',
      })

      expect(result[0].loader.version).toBe('0.19.2')
      expect(result[0].hashed).toBeDefined()
    })
  })

  describe('DEFAULT_META_URL_QUILT', () => {
    test('should have correct default URL', () => {
      expect(DEFAULT_META_URL_QUILT).toBe('https://meta.quiltmc.org')
    })
  })

  describe('QuiltLoaderArtifact interface', () => {
    test('should have hashed property', () => {
      const artifact: QuiltLoaderArtifact = {
        loader: {
          maven: 'org.quiltmc:quilt-loader:0.19.2',
          version: '0.19.2',
          stable: true,
        },
        intermediary: {
          maven: 'org.quiltmc:intermediary:1.20.1',
          version: '1.20.1',
          stable: true,
        },
        launcherMeta: {
          version: 1,
          libraries: {
            client: [],
            common: [],
            server: [],
          },
          mainClass: {
            client: 'net.fabricmc.loader.launch.knot.KnotClient',
            server: 'net.fabricmc.loader.launch.knot.KnotServer',
          },
        },
        hashed: {
          maven: 'org.quiltmc:hashed:1.20.1',
          version: '1.20.1',
          stable: true,
        },
      }

      expect(artifact.hashed).toBeDefined()
      expect(artifact.hashed.maven).toBe('org.quiltmc:hashed:1.20.1')
    })
  })
})
