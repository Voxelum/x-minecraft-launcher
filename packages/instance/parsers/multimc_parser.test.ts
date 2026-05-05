import { existsSync } from 'fs-extra'
import { join, sep } from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  detectMMCRoot,
  type MultiMCConfig,
  type MultiMCManifest,
  type MultiMCManifestComponent,
} from './multimc_parser'

// Mock fs-extra
vi.mock('fs-extra', () => ({
  readFile: vi.fn(),
  existsSync: vi.fn(),
}))

// Mock discovery module
vi.mock('../discovery', () => ({
  discoverInstanceFiles: vi.fn().mockResolvedValue([]),
}))
const env = {
  join,
  existsSync,
} as any

describe('MultiMC Parser', () => {
  describe('detectMMCRoot', () => {
    it('should return the input path if instances folder exists', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = detectMMCRoot('/mmc')
      expect(result).toBe('/mmc')
      expect(existsSync).toHaveBeenCalledWith('/mmc/instances'.replaceAll('/', sep))
    })

    it('should return parent directory if current path has instances subfolder', () => {
      vi.mocked(existsSync)
        .mockImplementation((p) => p.toString().replaceAll(sep, '/') === '/mmc/instances') // /mmc/instances/test-instance/instances doesn't exist

      const result = detectMMCRoot('/mmc/instances/test-instance')
      expect(result).toBe('/mmc')
    })

    it('should return input path if no instances folder is found', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = detectMMCRoot('/some/path')
      expect(result).toBe('/some/path')
    })
  })

  describe('Type Definitions', () => {
    describe('MultiMCConfig', () => {
      it('should support basic configuration properties', () => {
        const config: Partial<MultiMCConfig> = {
          name: 'Test Instance',
          notes: 'Test description',
          JavaPath: '/path/to/java',
          JoinServerOnLaunch: 'true',
          JoinServerOnLaunchAddress: 'test.server.com:25565',
        }

        expect(config.name).toBe('Test Instance')
        expect(config.notes).toBe('Test description')
        expect(config.JavaPath).toBe('/path/to/java')
        expect(config.JoinServerOnLaunch).toBe('true')
        expect(config.JoinServerOnLaunchAddress).toBe('test.server.com:25565')
      })
    })

    describe('MultiMCManifestComponent', () => {
      it('should have proper component structure', () => {
        const component: MultiMCManifestComponent = {
          uid: 'net.minecraft',
          version: '1.19.2',
          cachedName: 'Minecraft',
          cachedVersion: '1.19.2',
          cachedRequires: [],
          important: true,
        }

        expect(component.uid).toBe('net.minecraft')
        expect(component.version).toBe('1.19.2')
        expect(component.cachedName).toBe('Minecraft')
        expect(component.cachedVersion).toBe('1.19.2')
        expect(Array.isArray(component.cachedRequires)).toBe(true)
        expect(component.important).toBe(true)
      })

      it('should support component dependencies', () => {
        const component: MultiMCManifestComponent = {
          uid: 'net.minecraftforge',
          version: '43.2.0',
          cachedName: 'Forge',
          cachedVersion: '43.2.0',
          cachedRequires: [{ uid: 'net.minecraft', equals: '1.19.2' }],
        }

        expect(component.cachedRequires).toHaveLength(1)
        expect(component.cachedRequires[0].uid).toBe('net.minecraft')
        expect(component.cachedRequires[0].equals).toBe('1.19.2')
      })

      it('should support various mod loader UIDs', () => {
        const components: MultiMCManifestComponent[] = [
          {
            uid: 'net.minecraft',
            version: '1.19.2',
            cachedName: 'Minecraft',
            cachedVersion: '1.19.2',
            cachedRequires: [],
          },
          {
            uid: 'net.minecraftforge',
            version: '43.2.0',
            cachedName: 'Forge',
            cachedVersion: '43.2.0',
            cachedRequires: [],
          },
          {
            uid: 'net.fabricmc.fabric-loader',
            version: '0.14.21',
            cachedName: 'Fabric Loader',
            cachedVersion: '0.14.21',
            cachedRequires: [],
          },
          {
            uid: 'net.neoforge',
            version: '20.4.109',
            cachedName: 'NeoForge',
            cachedVersion: '20.4.109',
            cachedRequires: [],
          },
          {
            uid: 'org.quiltmc.quilt-loader',
            version: '0.19.2',
            cachedName: 'Quilt Loader',
            cachedVersion: '0.19.2',
            cachedRequires: [],
          },
        ]

        expect(components).toHaveLength(5)
        expect(components.find((c) => c.uid === 'net.minecraft')).toBeDefined()
        expect(components.find((c) => c.uid === 'net.minecraftforge')).toBeDefined()
        expect(components.find((c) => c.uid === 'net.fabricmc.fabric-loader')).toBeDefined()
        expect(components.find((c) => c.uid === 'net.neoforge')).toBeDefined()
        expect(components.find((c) => c.uid === 'org.quiltmc.quilt-loader')).toBeDefined()
      })
    })

    describe('MultiMCManifest', () => {
      it('should have proper manifest structure', () => {
        const manifest: MultiMCManifest = {
          formatVersion: 1,
          components: [
            {
              uid: 'net.minecraft',
              version: '1.19.2',
              cachedName: 'Minecraft',
              cachedVersion: '1.19.2',
              cachedRequires: [],
            },
            {
              uid: 'net.minecraftforge',
              version: '43.2.0',
              cachedName: 'Forge',
              cachedVersion: '43.2.0',
              cachedRequires: [{ uid: 'net.minecraft', equals: '1.19.2' }],
            },
          ],
        }

        expect(manifest.formatVersion).toBe(1)
        expect(manifest.components).toHaveLength(2)
        expect(manifest.components[0].uid).toBe('net.minecraft')
        expect(manifest.components[1].uid).toBe('net.minecraftforge')
        expect(manifest.components[1].cachedRequires[0].uid).toBe('net.minecraft')
      })
    })
  })

  describe('Path Handling', () => {
    it('should handle Windows paths correctly', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = detectMMCRoot('C:\\MultiMC')
      expect(result).toBe('C:\\MultiMC')
    })

    it('should handle Unix paths correctly', () => {
      vi.mocked(existsSync).mockReturnValue(true)

      const result = detectMMCRoot('/home/user/MultiMC')
      expect(result).toBe('/home/user/MultiMC')
    })
  })
})
