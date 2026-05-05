import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_FORGE_MAVEN,
  getForgeVersionList,
  ForgeVersion,
  ForgeVersionList,
} from './forge.browser'

// Mock the forge-site-parser
vi.mock('@xmcl/forge-site-parser', () => ({
  parse: vi.fn((html: string) => {
    if (html.includes('1.20.1')) {
      return {
        mcversion: '1.20.1',
        versions: [
          {
            installer: {
              md5: 'abc123',
              sha1: 'def456',
              path: '/maven/net/minecraftforge/forge/1.20.1-47.1.0/forge-1.20.1-47.1.0-installer.jar',
            },
            universal: {
              md5: 'ghi789',
              sha1: 'jkl012',
              path: '/maven/net/minecraftforge/forge/1.20.1-47.1.0/forge-1.20.1-47.1.0-universal.jar',
            },
            mcversion: '1.20.1',
            version: '47.1.0',
            type: 'latest' as const,
          },
          {
            installer: {
              md5: 'mno345',
              sha1: 'pqr678',
              path: '/maven/net/minecraftforge/forge/1.20.1-47.0.0/forge-1.20.1-47.0.0-installer.jar',
            },
            universal: {
              md5: 'stu901',
              sha1: 'vwx234',
              path: '/maven/net/minecraftforge/forge/1.20.1-47.0.0/forge-1.20.1-47.0.0-universal.jar',
            },
            mcversion: '1.20.1',
            version: '47.0.0',
            type: 'recommended' as const,
          },
        ],
      }
    }
    return {
      mcversion: '',
      versions: [],
    }
  }),
}))

describe('forge.browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getForgeVersionList', () => {
    test('should fetch forge version list for all versions', async () => {
      const mockHtml = '<html>forge versions</html>'
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
      })

      const result = await getForgeVersionList({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://files.minecraftforge.net/maven/net/minecraftforge/forge/index.html',
        expect.any(Object),
      )
      expect(result).toHaveProperty('mcversion')
      expect(result).toHaveProperty('versions')
    })

    test('should fetch forge version list for specific minecraft version', async () => {
      const mockHtml = '<html>1.20.1 forge versions</html>'
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
      })

      const result = await getForgeVersionList({
        fetch: mockFetch,
        minecraft: '1.20.1',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://files.minecraftforge.net/maven/net/minecraftforge/forge/index_1.20.1.html',
        expect.any(Object),
      )
      expect(result.mcversion).toBe('1.20.1')
      expect(result.versions).toHaveLength(2)
    })

    test('should parse forge versions correctly', async () => {
      const mockHtml = '1.20.1 versions'
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
      })

      const result = await getForgeVersionList({
        fetch: mockFetch,
        minecraft: '1.20.1',
      })

      expect(result.versions[0]).toMatchObject({
        mcversion: '1.20.1',
        version: '47.1.0',
        type: 'latest',
      })
      expect(result.versions[0].installer).toHaveProperty('md5')
      expect(result.versions[0].installer).toHaveProperty('sha1')
      expect(result.versions[0].installer).toHaveProperty('path')
      expect(result.versions[0].universal).toHaveProperty('md5')
      expect(result.versions[0].universal).toHaveProperty('sha1')
      expect(result.versions[0].universal).toHaveProperty('path')
    })

    test('should handle empty minecraft version parameter', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '',
      })

      await getForgeVersionList({ fetch: mockFetch, minecraft: '' })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://files.minecraftforge.net/maven/net/minecraftforge/forge/index.html',
        expect.any(Object),
      )
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '',
      })

      await getForgeVersionList({
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
        text: async () => '',
      } as any)

      const result = await getForgeVersionList()

      expect(result).toHaveProperty('mcversion')
      expect(result).toHaveProperty('versions')
      mockFetch.mockRestore()
    })

    test('should handle different minecraft versions', async () => {
      const versions = ['1.19.4', '1.18.2', '1.16.5', '1.12.2']

      for (const version of versions) {
        const mockFetch = vi.fn().mockResolvedValue({
          text: async () => '',
        })

        await getForgeVersionList({
          fetch: mockFetch,
          minecraft: version,
        })

        expect(mockFetch).toHaveBeenCalledWith(
          `http://files.minecraftforge.net/maven/net/minecraftforge/forge/index_${version}.html`,
          expect.any(Object),
        )
      }
    })

    test('should handle version types', async () => {
      const mockHtml = '1.20.1'
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
      })

      const result = await getForgeVersionList({
        fetch: mockFetch,
        minecraft: '1.20.1',
      })

      const types = result.versions.map((v) => v.type)
      expect(types).toContain('latest')
      expect(types).toContain('recommended')
    })
  })

  describe('DEFAULT_FORGE_MAVEN', () => {
    test('should have correct default URL', () => {
      expect(DEFAULT_FORGE_MAVEN).toBe('http://files.minecraftforge.net/maven')
    })
  })

  describe('ForgeVersion interface', () => {
    test('should have required properties', () => {
      const version: ForgeVersion = {
        installer: {
          md5: 'test-md5',
          sha1: 'test-sha1',
          path: '/test/path',
        },
        universal: {
          md5: 'test-md5',
          sha1: 'test-sha1',
          path: '/test/path',
        },
        mcversion: '1.20.1',
        version: '47.0.0',
        type: 'latest',
      }

      expect(version.installer.md5).toBe('test-md5')
      expect(version.installer.sha1).toBe('test-sha1')
      expect(version.installer.path).toBe('/test/path')
      expect(version.universal.md5).toBe('test-md5')
      expect(version.universal.sha1).toBe('test-sha1')
      expect(version.universal.path).toBe('/test/path')
      expect(version.mcversion).toBe('1.20.1')
      expect(version.version).toBe('47.0.0')
      expect(version.type).toBe('latest')
    })

    test('should support all version types', () => {
      const types: Array<ForgeVersion['type']> = ['buggy', 'recommended', 'common', 'latest']

      types.forEach((type) => {
        const version: ForgeVersion = {
          installer: { md5: '', sha1: '', path: '' },
          universal: { md5: '', sha1: '', path: '' },
          mcversion: '1.20.1',
          version: '47.0.0',
          type,
        }

        expect(version.type).toBe(type)
      })
    })
  })
})
