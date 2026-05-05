import { describe, test, expect, vi, beforeEach } from 'vitest'
import { getLabyModManifest, LabyModManifest } from './labymod.browser'

describe('labymod.browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLabyModManifest', () => {
    test('should fetch labymod manifest for production', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: 'https://example.com/shader.zip',
          common: 'https://example.com/common.zip',
          fonts: 'https://example.com/fonts.zip',
          'vanilla-theme': 'https://example.com/vanilla-theme.zip',
          'fancy-theme': 'https://example.com/fancy-theme.zip',
          i18n: 'https://example.com/i18n.zip',
        },
        minecraftVersions: [
          {
            tag: '1.20.1',
            version: '1.20.1',
            index: 0,
            type: 'release',
            runtime: {
              name: 'java-runtime-gamma',
              version: 17,
            },
            customManifestUrl: 'https://example.com/1.20.1.json',
          },
        ],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getLabyModManifest('production', { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/production/latest.json',
        expect.any(Object),
      )
      expect(result).toEqual(mockManifest)
      expect(result.labyModVersion).toBe('4.0.5')
      expect(result.minecraftVersions).toHaveLength(1)
    })

    test('should fetch labymod manifest for staging', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.1.0-beta',
        commitReference: 'xyz789',
        sha1: 'ghi012',
        releaseTime: 1686912000000,
        size: 12345678,
        assets: {
          shader: 'https://example.com/shader.zip',
          common: 'https://example.com/common.zip',
          fonts: 'https://example.com/fonts.zip',
          'vanilla-theme': 'https://example.com/vanilla-theme.zip',
          'fancy-theme': 'https://example.com/fancy-theme.zip',
          i18n: 'https://example.com/i18n.zip',
        },
        minecraftVersions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getLabyModManifest('staging', { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/staging/latest.json',
        expect.any(Object),
      )
      expect(result.labyModVersion).toBe('4.1.0-beta')
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: '',
          common: '',
          fonts: '',
          'vanilla-theme': '',
          'fancy-theme': '',
          i18n: '',
        },
        minecraftVersions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      await getLabyModManifest('production', {
        fetch: mockFetch,
        signal: controller.signal,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    test('should work without options', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: '',
          common: '',
          fonts: '',
          'vanilla-theme': '',
          'fancy-theme': '',
          i18n: '',
        },
        minecraftVersions: [],
      }
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => mockManifest,
      } as any)

      const result = await getLabyModManifest()

      expect(result).toHaveProperty('labyModVersion')
      expect(result).toHaveProperty('assets')
      expect(result).toHaveProperty('minecraftVersions')
      mockFetch.mockRestore()
    })

    test('should handle empty minecraft versions', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: '',
          common: '',
          fonts: '',
          'vanilla-theme': '',
          'fancy-theme': '',
          i18n: '',
        },
        minecraftVersions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getLabyModManifest('production', { fetch: mockFetch })

      expect(result.minecraftVersions).toEqual([])
    })

    test('should handle multiple minecraft versions', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: '',
          common: '',
          fonts: '',
          'vanilla-theme': '',
          'fancy-theme': '',
          i18n: '',
        },
        minecraftVersions: [
          {
            tag: '1.20.1',
            version: '1.20.1',
            index: 0,
            type: 'release',
            runtime: { name: 'java-runtime-gamma', version: 17 },
            customManifestUrl: 'https://example.com/1.20.1.json',
          },
          {
            tag: '1.19.4',
            version: '1.19.4',
            index: 1,
            type: 'release',
            runtime: { name: 'java-runtime-gamma', version: 17 },
            customManifestUrl: 'https://example.com/1.19.4.json',
          },
          {
            tag: '1.18.2',
            version: '1.18.2',
            index: 2,
            type: 'release',
            runtime: { name: 'java-runtime-alpha', version: 16 },
            customManifestUrl: 'https://example.com/1.18.2.json',
          },
        ],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getLabyModManifest('production', { fetch: mockFetch })

      expect(result.minecraftVersions).toHaveLength(3)
      expect(result.minecraftVersions[0].version).toBe('1.20.1')
      expect(result.minecraftVersions[2].runtime.version).toBe(16)
    })

    test('should handle all asset types', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: 'https://example.com/shader.zip',
          common: 'https://example.com/common.zip',
          fonts: 'https://example.com/fonts.zip',
          'vanilla-theme': 'https://example.com/vanilla-theme.zip',
          'fancy-theme': 'https://example.com/fancy-theme.zip',
          i18n: 'https://example.com/i18n.zip',
        },
        minecraftVersions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      const result = await getLabyModManifest('production', { fetch: mockFetch })

      expect(result.assets.shader).toBe('https://example.com/shader.zip')
      expect(result.assets.common).toBe('https://example.com/common.zip')
      expect(result.assets.fonts).toBe('https://example.com/fonts.zip')
      expect(result.assets['vanilla-theme']).toBe('https://example.com/vanilla-theme.zip')
      expect(result.assets['fancy-theme']).toBe('https://example.com/fancy-theme.zip')
      expect(result.assets.i18n).toBe('https://example.com/i18n.zip')
    })

    test('should default to production environment', async () => {
      const mockManifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: '',
          common: '',
          fonts: '',
          'vanilla-theme': '',
          'fancy-theme': '',
          i18n: '',
        },
        minecraftVersions: [],
      }
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => mockManifest,
      })

      await getLabyModManifest(undefined, { fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/production/latest.json',
        expect.any(Object),
      )
    })
  })

  describe('LabyModManifest interface', () => {
    test('should have all required properties', () => {
      const manifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: 'https://example.com/shader.zip',
          common: 'https://example.com/common.zip',
          fonts: 'https://example.com/fonts.zip',
          'vanilla-theme': 'https://example.com/vanilla-theme.zip',
          'fancy-theme': 'https://example.com/fancy-theme.zip',
          i18n: 'https://example.com/i18n.zip',
        },
        minecraftVersions: [],
      }

      expect(manifest.labyModVersion).toBe('4.0.5')
      expect(manifest.commitReference).toBe('abc123')
      expect(manifest.sha1).toBe('def456')
      expect(manifest.releaseTime).toBe(1686825600000)
      expect(manifest.size).toBe(12345678)
      expect(manifest.assets).toBeDefined()
      expect(manifest.minecraftVersions).toEqual([])
    })

    test('should support different runtime versions', () => {
      const manifest: LabyModManifest = {
        labyModVersion: '4.0.5',
        commitReference: 'abc123',
        sha1: 'def456',
        releaseTime: 1686825600000,
        size: 12345678,
        assets: {
          shader: '',
          common: '',
          fonts: '',
          'vanilla-theme': '',
          'fancy-theme': '',
          i18n: '',
        },
        minecraftVersions: [
          {
            tag: '1.20.1',
            version: '1.20.1',
            index: 0,
            type: 'release',
            runtime: { name: 'java-runtime-gamma', version: 17 },
            customManifestUrl: '',
          },
          {
            tag: '1.18.2',
            version: '1.18.2',
            index: 1,
            type: 'release',
            runtime: { name: 'java-runtime-alpha', version: 16 },
            customManifestUrl: '',
          },
          {
            tag: '1.12.2',
            version: '1.12.2',
            index: 2,
            type: 'release',
            runtime: { name: 'jre-legacy', version: 8 },
            customManifestUrl: '',
          },
        ],
      }

      expect(manifest.minecraftVersions[0].runtime.version).toBe(17)
      expect(manifest.minecraftVersions[1].runtime.version).toBe(16)
      expect(manifest.minecraftVersions[2].runtime.version).toBe(8)
    })
  })
})
