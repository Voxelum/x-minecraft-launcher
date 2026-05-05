import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@xmcl/core'
import {
  fetchJavaRuntimeManifest,
  JavaRuntimes,
  JavaRuntimeTargets,
  JavaRuntimeTarget,
  JavaRuntimeManifest,
  JavaRuntimeTargetType,
  FileEntry,
  DirectoryEntry,
  LinkEntry,
  DownloadInfo,
  DEFAULT_RUNTIME_ALL_URL,
} from './java-runtime.browser'

// Mock @xmcl/core
vi.mock('@xmcl/core', () => ({
  getPlatform: vi.fn(() => ({
    name: 'windows',
    arch: 'x64',
    version: '10.0.0',
  })),
  Platform: class {},
}))

describe('java-runtime.browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchJavaRuntimeManifest', () => {
    const mockJavaRuntime: JavaRuntimeTarget = {
      availability: {
        group: 1,
        progress: 100,
      },
      manifest: {
        sha1: 'abc123',
        size: 123456,
        url: 'https://launchermeta.mojang.com/v1/packages/abc123/manifest.json',
      },
      version: {
        name: '17.0.1',
        released: '2021-10-19T08:00:00+00:00',
      },
    }

    const mockRuntimeTargets: JavaRuntimeTargets = {
      'java-runtime-alpha': [mockJavaRuntime],
      'java-runtime-beta': [mockJavaRuntime],
      'java-runtime-delta': [mockJavaRuntime],
      'jre-legacy': [mockJavaRuntime],
      'minecraft-java-exe': [mockJavaRuntime],
      'java-runtime-gamma': [mockJavaRuntime],
    }

    const mockAllRuntimes: JavaRuntimes = {
      linux: mockRuntimeTargets,
      'linux-i386': mockRuntimeTargets,
      'mac-os': mockRuntimeTargets,
      'mac-os-arm64': mockRuntimeTargets,
      'windows-x64': mockRuntimeTargets,
      'windows-x86': mockRuntimeTargets,
      'windows-arm64': mockRuntimeTargets,
    }

    const mockManifest: JavaRuntimeManifest = {
      target: JavaRuntimeTargetType.Beta,
      files: {
        'bin/java.exe': {
          type: 'file',
          executable: true,
          downloads: {
            raw: {
              sha1: 'def456',
              size: 654321,
              url: 'https://libraries.minecraft.net/bin/java.exe',
            },
          },
        },
        lib: {
          type: 'directory',
        },
      },
      version: {
        name: '17.0.1',
        released: '2021-10-19T08:00:00+00:00',
      },
    }

    test('should fetch java runtime manifest for windows x64', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      const result = await fetchJavaRuntimeManifest({ fetch: mockFetch })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1, DEFAULT_RUNTIME_ALL_URL, expect.any(Object))
      expect(result).toHaveProperty('files')
      expect(result).toHaveProperty('target')
      expect(result).toHaveProperty('version')
      expect(result.target).toBe(JavaRuntimeTargetType.Beta)
    })

    test('should use custom platform', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      const customPlatform: Platform = {
        name: 'osx',
        arch: 'arm64',
        version: '11.0',
      }

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        platform: customPlatform,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('should use custom target type', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        target: JavaRuntimeTargetType.Gamma,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('should use custom runtime URL', async () => {
      const customUrl = 'https://custom.example.com/runtime.json'
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        url: customUrl,
      })

      expect(mockFetch).toHaveBeenNthCalledWith(1, customUrl, expect.any(Object))
    })

    test('should use provided manifestIndex', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({ json: async () => mockManifest })

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        manifestIndex: mockAllRuntimes,
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).not.toHaveBeenCalledWith(DEFAULT_RUNTIME_ALL_URL, expect.any(Object))
    })

    test('should use custom signal', async () => {
      const controller = new AbortController()
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        signal: controller.signal,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    test('should handle different windows architectures', async () => {
      const platforms: Array<[string, keyof JavaRuntimes]> = [
        ['x64', 'windows-x64'],
        ['x86', 'windows-x86'],
        ['x32', 'windows-x86'],
        ['arm64', 'windows-arm64'],
      ]

      for (const [arch, expected] of platforms) {
        const mockFetch = vi
          .fn()
          .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
          .mockResolvedValueOnce({ json: async () => mockManifest })

        await fetchJavaRuntimeManifest({
          fetch: mockFetch,
          platform: { name: 'windows', arch, version: '10' } as Platform,
        })

        expect(mockFetch).toHaveBeenCalledTimes(2)
        mockFetch.mockClear()
      }
    })

    test('should handle mac os platforms', async () => {
      const platforms: Array<[string, keyof JavaRuntimes]> = [
        ['x64', 'mac-os'],
        ['arm64', 'mac-os-arm64'],
      ]

      for (const [arch, expected] of platforms) {
        const mockFetch = vi
          .fn()
          .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
          .mockResolvedValueOnce({ json: async () => mockManifest })

        await fetchJavaRuntimeManifest({
          fetch: mockFetch,
          platform: { name: 'osx', arch, version: '11' } as Platform,
        })

        expect(mockFetch).toHaveBeenCalledTimes(2)
        mockFetch.mockClear()
      }
    })

    test('should handle linux platforms', async () => {
      const platforms: Array<[string, keyof JavaRuntimes]> = [
        ['x64', 'linux'],
        ['x86', 'linux-i386'],
        ['x32', 'linux-i386'],
      ]

      for (const [arch, expected] of platforms) {
        const mockFetch = vi
          .fn()
          .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
          .mockResolvedValueOnce({ json: async () => mockManifest })

        await fetchJavaRuntimeManifest({
          fetch: mockFetch,
          platform: { name: 'linux', arch, version: '5.10' } as Platform,
        })

        expect(mockFetch).toHaveBeenCalledTimes(2)
        mockFetch.mockClear()
      }
    })

    test('should handle different runtime target types', async () => {
      const targets = [
        JavaRuntimeTargetType.Legacy,
        JavaRuntimeTargetType.Alpha,
        JavaRuntimeTargetType.Beta,
        JavaRuntimeTargetType.Delta,
        JavaRuntimeTargetType.Gamma,
        JavaRuntimeTargetType.JavaExe,
      ]

      for (const target of targets) {
        const mockFetch = vi
          .fn()
          .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
          .mockResolvedValueOnce({ json: async () => ({ ...mockManifest, target }) })

        await fetchJavaRuntimeManifest({
          fetch: mockFetch,
          target,
        })

        expect(mockFetch).toHaveBeenCalledTimes(2)
        mockFetch.mockClear()
      }
    })

    test('should parse manifest files correctly', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      const result = await fetchJavaRuntimeManifest({ fetch: mockFetch })

      expect(result.files).toBeDefined()
      expect(result.files['bin/java.exe']).toBeDefined()
      expect(result.files['bin/java.exe'].type).toBe('file')
      expect(result.files['lib'].type).toBe('directory')
    })

    test('should use custom apiHost as string', async () => {
      const customHost = 'custom.example.com'
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        apiHost: customHost,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(customHost),
        expect.any(Object),
      )
    })

    test('should use custom apiHost as array', async () => {
      const customHosts = ['custom1.example.com', 'custom2.example.com']
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ json: async () => mockAllRuntimes })
        .mockResolvedValueOnce({ json: async () => mockManifest })

      await fetchJavaRuntimeManifest({
        fetch: mockFetch,
        apiHost: customHosts,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('custom1.example.com'),
        expect.any(Object),
      )
    })

    test('should throw error for unsupported platform', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({ json: async () => mockAllRuntimes })

      await expect(
        fetchJavaRuntimeManifest({
          fetch: mockFetch,
          platform: { name: 'unsupported', arch: 'unknown', version: '1.0' } as any,
        }),
      ).rejects.toThrow()
    })

    test('should throw error when target not found', async () => {
      const emptyRuntimeTargets: JavaRuntimeTargets = {
        'java-runtime-alpha': [],
        'java-runtime-beta': [],
        'jre-legacy': [],
        'minecraft-java-exe': [],
      }

      const emptyRuntimes: JavaRuntimes = {
        linux: emptyRuntimeTargets,
        'linux-i386': emptyRuntimeTargets,
        'mac-os': emptyRuntimeTargets,
        'mac-os-arm64': emptyRuntimeTargets,
        'windows-x64': emptyRuntimeTargets,
        'windows-x86': emptyRuntimeTargets,
        'windows-arm64': emptyRuntimeTargets,
      }

      const mockFetch = vi.fn().mockResolvedValueOnce({ json: async () => emptyRuntimes })

      await expect(fetchJavaRuntimeManifest({ fetch: mockFetch })).rejects.toThrow()
    })
  })

  describe('DEFAULT_RUNTIME_ALL_URL', () => {
    test('should have correct default URL', () => {
      expect(DEFAULT_RUNTIME_ALL_URL).toBe(
        'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json',
      )
    })
  })

  describe('JavaRuntimeTargetType enum', () => {
    test('should have all runtime types', () => {
      expect(JavaRuntimeTargetType.Legacy).toBe('jre-legacy')
      expect(JavaRuntimeTargetType.Alpha).toBe('java-runtime-alpha')
      expect(JavaRuntimeTargetType.Beta).toBe('java-runtime-beta')
      expect(JavaRuntimeTargetType.Delta).toBe('java-runtime-delta')
      expect(JavaRuntimeTargetType.Gamma).toBe('java-runtime-gamma')
      expect(JavaRuntimeTargetType.JavaExe).toBe('minecraft-java-exe')
    })
  })

  describe('JavaRuntimeTarget interface', () => {
    test('should have required properties', () => {
      const target: JavaRuntimeTarget = {
        availability: {
          group: 1,
          progress: 100,
        },
        manifest: {
          sha1: 'abc123',
          size: 123456,
          url: 'https://example.com/manifest.json',
        },
        version: {
          name: '17.0.1',
          released: '2021-10-19T08:00:00+00:00',
        },
      }

      expect(target.availability.group).toBe(1)
      expect(target.availability.progress).toBe(100)
      expect(target.manifest.sha1).toBe('abc123')
      expect(target.version.name).toBe('17.0.1')
    })
  })

  describe('DownloadInfo interface', () => {
    test('should have required properties', () => {
      const info: DownloadInfo = {
        sha1: 'abc123',
        size: 123456,
        url: 'https://example.com/file.jar',
      }

      expect(info.sha1).toBe('abc123')
      expect(info.size).toBe(123456)
      expect(info.url).toBe('https://example.com/file.jar')
    })
  })

  describe('FileEntry interface', () => {
    test('should have file properties', () => {
      const file: FileEntry = {
        type: 'file',
        executable: true,
        downloads: {
          raw: {
            sha1: 'abc123',
            size: 123456,
            url: 'https://example.com/file.jar',
          },
        },
      }

      expect(file.type).toBe('file')
      expect(file.executable).toBe(true)
      expect(file.downloads.raw).toBeDefined()
    })

    test('should support lzma download', () => {
      const file: FileEntry = {
        type: 'file',
        executable: false,
        downloads: {
          raw: {
            sha1: 'abc123',
            size: 123456,
            url: 'https://example.com/file.jar',
          },
          lzma: {
            sha1: 'def456',
            size: 65432,
            url: 'https://example.com/file.jar.lzma',
          },
        },
      }

      expect(file.downloads.lzma).toBeDefined()
      expect(file.downloads.lzma!.url).toBe('https://example.com/file.jar.lzma')
    })
  })

  describe('DirectoryEntry interface', () => {
    test('should have directory type', () => {
      const dir: DirectoryEntry = {
        type: 'directory',
      }

      expect(dir.type).toBe('directory')
    })
  })

  describe('LinkEntry interface', () => {
    test('should have link properties', () => {
      const link: LinkEntry = {
        type: 'link',
        target: '../bin/java',
      }

      expect(link.type).toBe('link')
      expect(link.target).toBe('../bin/java')
    })
  })

  describe('JavaRuntimeManifest interface', () => {
    test('should have all required properties', () => {
      const manifest: JavaRuntimeManifest = {
        target: JavaRuntimeTargetType.Gamma,
        files: {
          'bin/java': {
            type: 'file',
            executable: true,
            downloads: {
              raw: {
                sha1: 'abc123',
                size: 123456,
                url: 'https://example.com/java',
              },
            },
          },
          lib: {
            type: 'directory',
          },
          'bin/java.link': {
            type: 'link',
            target: './java',
          },
        },
        version: {
          name: '17.0.1',
          released: '2021-10-19T08:00:00+00:00',
        },
      }

      expect(manifest.target).toBe(JavaRuntimeTargetType.Gamma)
      expect(manifest.files).toBeDefined()
      expect(manifest.version.name).toBe('17.0.1')
      expect(Object.keys(manifest.files)).toHaveLength(3)
    })
  })

  describe('JavaRuntimes interface', () => {
    test('should have all platform properties', () => {
      const runtimeTargets: JavaRuntimeTargets = {
        'java-runtime-alpha': [],
        'java-runtime-beta': [],
        'jre-legacy': [],
        'minecraft-java-exe': [],
      }

      const runtimes: JavaRuntimes = {
        linux: runtimeTargets,
        'linux-i386': runtimeTargets,
        'mac-os': runtimeTargets,
        'mac-os-arm64': runtimeTargets,
        'windows-x64': runtimeTargets,
        'windows-x86': runtimeTargets,
        'windows-arm64': runtimeTargets,
      }

      expect(runtimes.linux).toBeDefined()
      expect(runtimes['linux-i386']).toBeDefined()
      expect(runtimes['mac-os']).toBeDefined()
      expect(runtimes['mac-os-arm64']).toBeDefined()
      expect(runtimes['windows-x64']).toBeDefined()
      expect(runtimes['windows-x86']).toBeDefined()
      expect(runtimes['windows-arm64']).toBeDefined()
    })
  })
})
