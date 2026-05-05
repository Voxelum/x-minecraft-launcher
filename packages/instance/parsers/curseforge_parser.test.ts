import { describe, it, expect } from 'vitest'
import { type CurseforgeInstance } from './curseforge_parser'

describe('CurseForge Parser', () => {
  describe('Type Definitions', () => {
    describe('CurseforgeInstance', () => {
      it('should have proper instance structure', () => {
        const instance: CurseforgeInstance = {
          baseModLoader: {
            name: 'forge',
            downloadUrl:
              'https://files.minecraftforge.net/maven/net/minecraftforge/forge/1.19.2-43.2.0',
            versionJson: 'forge-1.19.2-43.2.0.json',
            minecraftVersion: '1.19.2',
            forgeVersion: '43.2.0',
          },
          gameVersion: '1.19.2',
          name: 'Test Instance',
          lastPlayed: '2023-01-01T00:00:00Z',
          manifest: {
            minecraft: {
              version: '1.19.2',
              modLoaders: [
                {
                  id: 'forge-43.2.0',
                  primary: true,
                },
              ],
            },
            manifestType: 'minecraftModpack',
            overrides: 'overrides',
            manifestVersion: 1,
            version: '1.0.0',
            author: 'Test Author',
            name: 'Test Modpack',
            files: [],
          },
          projectID: 123456,
          fileID: 789012,
          isMemoryOverride: false,
          allocatedMemory: 4096,
          instancePath: '/path/to/instance',
          installedAddons: [],
        }

        expect(instance.baseModLoader.name).toBe('forge')
        expect(instance.baseModLoader.minecraftVersion).toBe('1.19.2')
        expect(instance.baseModLoader.forgeVersion).toBe('43.2.0')
        expect(instance.gameVersion).toBe('1.19.2')
        expect(instance.name).toBe('Test Instance')
        expect(instance.projectID).toBe(123456)
        expect(instance.fileID).toBe(789012)
        expect(instance.isMemoryOverride).toBe(false)
        expect(instance.allocatedMemory).toBe(4096)
      })

      it('should support different mod loaders', () => {
        const loaders = [
          { name: 'forge', version: '43.2.0' },
          { name: 'fabric', version: '0.14.21' },
          { name: 'quilt', version: '0.19.2' },
        ]

        loaders.forEach((loader) => {
          const instance: CurseforgeInstance = {
            baseModLoader: {
              name: loader.name,
              downloadUrl: `https://example.com/${loader.name}`,
              versionJson: `${loader.name}-${loader.version}.json`,
              minecraftVersion: '1.19.2',
            },
            gameVersion: '1.19.2',
            name: `${loader.name} Instance`,
            lastPlayed: new Date().toISOString(),
            manifest: {
              minecraft: {
                version: '1.19.2',
                modLoaders: [
                  {
                    id: `${loader.name}-${loader.version}`,
                    primary: true,
                  },
                ],
              },
              manifestType: 'minecraftModpack',
              overrides: 'overrides',
              manifestVersion: 1,
              version: '1.0.0',
              author: 'Test',
              name: 'Test',
              files: [],
            },
            projectID: 123456,
            fileID: 789012,
            isMemoryOverride: false,
            allocatedMemory: 4096,
            instancePath: '/path/to/instance',
            installedAddons: [],
          }

          expect(instance.baseModLoader.name).toBe(loader.name)
          expect(instance.manifest.minecraft.modLoaders[0].id).toBe(
            `${loader.name}-${loader.version}`,
          )
        })
      })

      it('should support memory override', () => {
        const instance: CurseforgeInstance = {
          baseModLoader: {
            name: 'forge',
            downloadUrl: 'https://example.com/forge',
            versionJson: 'forge.json',
            minecraftVersion: '1.19.2',
          },
          gameVersion: '1.19.2',
          name: 'Memory Override Instance',
          lastPlayed: new Date().toISOString(),
          manifest: {
            minecraft: {
              version: '1.19.2',
              modLoaders: [{ id: 'forge-43.2.0', primary: true }],
            },
            manifestType: 'minecraftModpack',
            overrides: 'overrides',
            manifestVersion: 1,
            version: '1.0.0',
            author: 'Test',
            name: 'Test',
            files: [],
          },
          projectID: 123456,
          fileID: 789012,
          isMemoryOverride: true,
          allocatedMemory: 8192,
          instancePath: '/path/to/instance',
          installedAddons: [],
          javaArgsOverride: '-Xmx8G -Xms4G',
        }

        expect(instance.isMemoryOverride).toBe(true)
        expect(instance.allocatedMemory).toBe(8192)
        expect(instance.javaArgsOverride).toBe('-Xmx8G -Xms4G')
      })

      it('should support custom author', () => {
        const instance: CurseforgeInstance = {
          baseModLoader: {
            name: 'forge',
            downloadUrl: 'https://example.com/forge',
            versionJson: 'forge.json',
            minecraftVersion: '1.19.2',
          },
          gameVersion: '1.19.2',
          name: 'Custom Author Instance',
          lastPlayed: new Date().toISOString(),
          manifest: {
            minecraft: {
              version: '1.19.2',
              modLoaders: [{ id: 'forge-43.2.0', primary: true }],
            },
            manifestType: 'minecraftModpack',
            overrides: 'overrides',
            manifestVersion: 1,
            version: '1.0.0',
            author: 'Original Author',
            name: 'Test',
            files: [],
          },
          projectID: 123456,
          fileID: 789012,
          customAuthor: 'Custom Author Override',
          isMemoryOverride: false,
          allocatedMemory: 4096,
          instancePath: '/path/to/instance',
          installedAddons: [],
        }

        expect(instance.customAuthor).toBe('Custom Author Override')
        expect(instance.manifest.author).toBe('Original Author')
      })

      it('should support installed addons', () => {
        const instance: CurseforgeInstance = {
          baseModLoader: {
            name: 'forge',
            downloadUrl: 'https://example.com/forge',
            versionJson: 'forge.json',
            minecraftVersion: '1.19.2',
          },
          gameVersion: '1.19.2',
          name: 'Addons Instance',
          lastPlayed: new Date().toISOString(),
          manifest: {
            minecraft: {
              version: '1.19.2',
              modLoaders: [{ id: 'forge-43.2.0', primary: true }],
            },
            manifestType: 'minecraftModpack',
            overrides: 'overrides',
            manifestVersion: 1,
            version: '1.0.0',
            author: 'Test',
            name: 'Test',
            files: [],
          },
          projectID: 123456,
          fileID: 789012,
          isMemoryOverride: false,
          allocatedMemory: 4096,
          instancePath: '/path/to/instance',
          installedAddons: [
            {
              addonID: 111111,
              installedFile: {
                id: 222222,
                fileName: 'test-mod.jar',
                downloadUrl: 'https://example.com/test-mod.jar',
                packageFingerprint: 333333,
                projectId: 111111,
                FileNameOnDisk: 'test-mod.jar',
                Hashes: [{ value: 'abc123def456' }],
              },
            },
            {
              addonID: 444444,
              installedFile: {
                id: 555555,
                fileName: 'another-mod.jar',
                downloadUrl: 'https://example.com/another-mod.jar',
                packageFingerprint: 666666,
                projectId: 444444,
                FileNameOnDisk: 'another-mod.jar',
                Hashes: [{ value: 'def456ghi789' }],
              },
            },
          ],
        }

        expect(instance.installedAddons).toHaveLength(2)
        expect(instance.installedAddons[0].addonID).toBe(111111)
        expect(instance.installedAddons[0].installedFile.fileName).toBe('test-mod.jar')
        expect(instance.installedAddons[1].addonID).toBe(444444)
        expect(instance.installedAddons[1].installedFile.fileName).toBe('another-mod.jar')
      })
    })
  })

  describe('Base Mod Loader Structure', () => {
    it('should validate base mod loader required fields', () => {
      const baseModLoader = {
        name: 'forge',
        downloadUrl:
          'https://files.minecraftforge.net/maven/net/minecraftforge/forge/1.19.2-43.2.0',
        versionJson: 'forge-1.19.2-43.2.0.json',
        minecraftVersion: '1.19.2',
      }

      expect(baseModLoader.name).toBeTruthy()
      expect(baseModLoader.downloadUrl).toMatch(/^https?:\/\//)
      expect(baseModLoader.versionJson).toMatch(/\.json$/)
      expect(baseModLoader.minecraftVersion).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('should support optional fields', () => {
      const baseModLoader = {
        name: 'forge',
        downloadUrl: 'https://example.com/forge',
        versionJson: 'forge.json',
        minecraftVersion: '1.19.2',
        forgeVersion: '43.2.0',
        installProfileJson: 'install_profile.json',
      }

      expect(baseModLoader.forgeVersion).toBe('43.2.0')
      expect(baseModLoader.installProfileJson).toBe('install_profile.json')
    })
  })

  describe('Installed Addon Structure', () => {
    it('should validate installed addon structure', () => {
      const addon = {
        addonID: 123456,
        installedFile: {
          id: 789012,
          fileName: 'example-mod.jar',
          downloadUrl: 'https://cdn.curseforge.com/files/1234/567/example-mod.jar',
          packageFingerprint: 987654321,
          projectId: 123456,
          FileNameOnDisk: 'example-mod.jar',
          Hashes: [{ value: 'abc123def456789' }, { value: 'def456ghi789abc' }],
        },
      }

      expect(typeof addon.addonID).toBe('number')
      expect(typeof addon.installedFile.id).toBe('number')
      expect(addon.installedFile.fileName).toBeTruthy()
      expect(addon.installedFile.downloadUrl).toMatch(/^https?:\/\//)
      expect(typeof addon.installedFile.packageFingerprint).toBe('number')
      expect(typeof addon.installedFile.projectId).toBe('number')
      expect(addon.installedFile.FileNameOnDisk).toBeTruthy()
      expect(Array.isArray(addon.installedFile.Hashes)).toBe(true)
      expect(addon.installedFile.Hashes.length).toBeGreaterThan(0)
    })
  })
})
