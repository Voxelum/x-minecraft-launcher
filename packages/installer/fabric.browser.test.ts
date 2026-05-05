import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_META_URL_FABRIC,
  getFabricGames,
  getFabricLoaders,
  getLoaderArtifactListFor,
  getFabricLoaderArtifact,
  FabricArtifactVersion,
  FabricLoaderArtifact,
} from './fabric.browser'

describe('fabric.browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFabricGames', () => {
    test('should fetch and return fabric game versions', async () => {
      const mockVersions = [
        { version: '1.20.1', stable: true },
        { version: '1.19.4', stable: true },
        { version: '23w13a', stable: false },
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockVersions,
      })

      const result = await getFabricGames({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_META_URL_FABRIC}/v2/game`,
        expect.objectContaining({ signal: undefined }),
      )
      expect(result).toEqual(['1.20.1', '1.19.4', '23w13a'])
    })

    test('should handle empty game versions', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      const result = await getFabricGames({ fetch: mockFetch })

      expect(result).toEqual([])
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      await getFabricGames({ fetch: mockFetch, signal: controller.signal })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    test('should work without options', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => [{ version: '1.20.1' }],
      } as any)

      const result = await getFabricGames()

      expect(result).toEqual(['1.20.1'])
      mockFetch.mockRestore()
    })
  })

  describe('getFabricLoaders', () => {
    test('should fetch and return fabric loader versions', async () => {
      const mockLoaders: FabricArtifactVersion[] = [
        {
          maven: 'net.fabricmc:fabric-loader:0.14.21',
          version: '0.14.21',
          stable: true,
        },
        {
          maven: 'net.fabricmc:fabric-loader:0.14.20',
          version: '0.14.20',
          stable: true,
        },
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockLoaders,
      })

      const result = await getFabricLoaders({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_META_URL_FABRIC}/v2/versions/loader`,
        expect.any(Object),
      )
      expect(result).toEqual(mockLoaders)
    })

    test('should handle empty loader list', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      const result = await getFabricLoaders({ fetch: mockFetch })

      expect(result).toEqual([])
    })

    test('should work without options', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => [{ version: '0.14.21' }],
      } as any)

      const result = await getFabricLoaders()

      expect(result).toHaveLength(1)
      mockFetch.mockRestore()
    })
  })

  describe('getLoaderArtifactListFor', () => {
    test('should fetch loader artifacts for specific minecraft version', async () => {
      const mockArtifacts: FabricLoaderArtifact[] = [
        {
          loader: {
            maven: 'net.fabricmc:fabric-loader:0.14.21',
            version: '0.14.21',
            stable: true,
          },
          intermediary: {
            maven: 'net.fabricmc:intermediary:1.20.1',
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
              client: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
              server: 'net.fabricmc.loader.impl.launch.knot.KnotServer',
            },
          },
        },
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockArtifacts,
      })

      const result = await getLoaderArtifactListFor('1.20.1', { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/1.20.1`,
        expect.any(Object),
      )
      expect(result).toEqual(mockArtifacts)
    })

    test('should handle snapshot versions', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => [],
      })

      await getLoaderArtifactListFor('23w13a', { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/23w13a`,
        expect.any(Object),
      )
    })

    test('should work without options', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => [],
      } as any)

      const result = await getLoaderArtifactListFor('1.20.1')

      expect(result).toEqual([])
      mockFetch.mockRestore()
    })
  })

  describe('getFabricLoaderArtifact', () => {
    test('should fetch specific loader artifact', async () => {
      const mockArtifact: FabricLoaderArtifact = {
        loader: {
          maven: 'net.fabricmc:fabric-loader:0.14.21',
          version: '0.14.21',
          stable: true,
        },
        intermediary: {
          maven: 'net.fabricmc:intermediary:1.20.1',
          version: '1.20.1',
          stable: true,
        },
        launcherMeta: {
          version: 1,
          libraries: {
            client: [
              { name: 'net.fabricmc:fabric-loader:0.14.21', url: 'https://maven.fabricmc.net/' },
            ],
            common: [],
            server: [],
          },
          mainClass: {
            client: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
            server: 'net.fabricmc.loader.impl.launch.knot.KnotServer',
          },
        },
      }

      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockArtifact,
      })

      const result = await getFabricLoaderArtifact('1.20.1', '0.14.21', { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/1.20.1/0.14.21`,
        expect.any(Object),
      )
      expect(result).toEqual(mockArtifact)
    })

    test('should handle different loader versions', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({}),
      })

      await getFabricLoaderArtifact('1.19.4', '0.14.20', { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/1.19.4/0.14.20`,
        expect.any(Object),
      )
    })

    test('should work without options', async () => {
      const mockArtifact = {
        loader: { version: '0.14.21' },
        intermediary: { version: '1.20.1' },
        launcherMeta: {
          version: 1,
          libraries: { client: [], common: [], server: [] },
          mainClass: { client: '', server: '' },
        },
      }

      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => mockArtifact,
      } as any)

      const result = await getFabricLoaderArtifact('1.20.1', '0.14.21')

      expect(result).toBeDefined()
      mockFetch.mockRestore()
    })

    test('should pass abort signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({}),
      })

      await getFabricLoaderArtifact('1.20.1', '0.14.21', {
        fetch: mockFetch,
        signal: controller.signal,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })
  })

  describe('DEFAULT_META_URL_FABRIC', () => {
    test('should have correct default URL', () => {
      expect(DEFAULT_META_URL_FABRIC).toBe('https://meta.fabricmc.net')
    })
  })
})
