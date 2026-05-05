import { describe, it, expect } from 'vitest'
import {
  getInstanceConfigFromMcbbsModpack,
  getInstanceConfigFromMmcModpack,
  getInstanceConfigFromCurseforgeModpack,
  getInstanceConfigFromModrinthModpack,
  getModrinthModpackFromInstance,
  getCurseforgeModpackFromInstance,
  getMcbbsModpackFromInstance,
  type McbbsModpackManifest,
  type MMCModpackManifest,
  type CurseforgeModpackManifest,
  type ModrinthModpackManifest,
} from './modpack'
import { type InstanceData } from './instance'

describe('Modpack Conversion Functions', () => {
  describe('getInstanceConfigFromMcbbsModpack', () => {
    it('should convert MCBBS modpack manifest to instance config', () => {
      const manifest: McbbsModpackManifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 2,
        name: 'Test Modpack',
        version: '1.0.0',
        author: 'Test Author',
        description: 'Test Description',
        url: 'https://example.com',
        addons: [
          { id: 'game', version: '1.19.2' },
          { id: 'forge', version: '43.2.0' },
          { id: 'fabric', version: '0.14.21' },
        ],
        launchInfo: {
          minMemory: 2048,
          launchArgument: ['--demo'],
          javaArgument: ['-Xmx4G'],
        },
      }

      const result = getInstanceConfigFromMcbbsModpack(manifest)

      expect(result.name).toBe('Test Modpack-1.0.0')
      expect(result.author).toBe('Test Author')
      expect(result.description).toBe('Test Description')
      expect(result.url).toBe('https://example.com')
      expect(result.runtime?.minecraft).toBe('1.19.2')
      expect(result.runtime?.forge).toBe('43.2.0')
      expect(result.runtime?.fabricLoader).toBe('0.14.21')
      expect(result.mcOptions).toEqual(['--demo'])
      expect(result.vmOptions).toEqual(['-Xmx4G'])
      expect(result.minMemory).toBe(2048)
    })

    it('should handle missing optional fields', () => {
      const manifest: McbbsModpackManifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 2,
        name: 'Simple Modpack',
        version: '1.0.0',
        author: 'Author',
        description: 'Description',
        url: 'https://example.com',
        addons: [{ id: 'game', version: '1.19.2' }],
      }

      const result = getInstanceConfigFromMcbbsModpack(manifest)

      expect(result.runtime?.forge).toBe('')
      expect(result.runtime?.fabricLoader).toBe('')
      expect(result.mcOptions).toBeUndefined()
      expect(result.vmOptions).toBeUndefined()
      expect(result.minMemory).toBeUndefined()
    })
  })

  describe('getInstanceConfigFromMmcModpack', () => {
    it('should convert MultiMC modpack manifest to instance config', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [
            { uid: 'net.minecraft', version: '1.19.2' },
            { uid: 'net.minecraftforge', version: '43.2.0' },
            { uid: 'net.fabricmc.fabric-loader', version: '0.14.21' },
            { uid: 'net.neoforge', version: '20.4.109' },
          ],
        },
        cfg: {
          name: 'MMC Test Pack',
          notes: 'Test notes',
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.name).toBe('MMC Test Pack')
      expect(result.description).toBe('Test notes')
      expect(result.runtime?.minecraft).toBe('1.19.2')
      expect(result.runtime?.forge).toBe('43.2.0')
      expect(result.runtime?.fabricLoader).toBe('0.14.21')
      expect(result.runtime?.neoForged).toBe('20.4.109')
    })

    it('should handle missing optional components', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [{ uid: 'net.minecraft', version: '1.19.2' }],
        },
        cfg: {
          name: 'Simple Pack',
          notes: 'Simple notes',
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.runtime?.forge).toBeUndefined()
      expect(result.runtime?.fabricLoader).toBeUndefined()
      expect(result.runtime?.neoForged).toBeUndefined()
    })
  })

  describe('getInstanceConfigFromCurseforgeModpack', () => {
    it('should convert CurseForge modpack manifest to instance config', () => {
      const manifest: CurseforgeModpackManifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        name: 'CF Test Pack',
        version: '2.0.0',
        author: 'CF Author',
        minecraft: {
          version: '1.19.2',
          modLoaders: [
            { id: 'forge-43.2.0', primary: true },
            { id: 'fabric-0.14.21', primary: false },
          ],
        },
        overrides: 'overrides',
      }

      const result = getInstanceConfigFromCurseforgeModpack(manifest)

      expect(result.name).toBe('CF Test Pack-2.0.0')
      expect(result.author).toBe('CF Author')
      expect(result.runtime?.minecraft).toBe('1.19.2')
      expect(result.runtime?.forge).toBe('43.2.0')
      expect(result.runtime?.fabricLoader).toBe('0.14.21')
    })

    it('should handle different mod loader prefixes', () => {
      const manifest: CurseforgeModpackManifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        name: 'NeoForge Pack',
        version: '1.0.0',
        author: 'Author',
        minecraft: {
          version: '1.20.1',
          modLoaders: [
            { id: 'neoforge-20.4.109', primary: true },
            { id: 'quilt-0.19.2', primary: false },
          ],
        },
        overrides: 'overrides',
      }

      const result = getInstanceConfigFromCurseforgeModpack(manifest)

      expect(result.runtime?.neoForged).toBe('20.4.109')
      expect(result.runtime?.quiltLoader).toBe('0.19.2')
    })
  })

  describe('getInstanceConfigFromModrinthModpack', () => {
    it('should convert Modrinth modpack manifest to instance config', () => {
      const manifest: ModrinthModpackManifest = {
        formatVersion: 1,
        game: 'minecraft',
        versionId: 'v1.2.3',
        name: 'Modrinth Pack',
        summary: 'A great modpack',
        dependencies: {
          minecraft: '1.19.2',
          forge: '43.2.0',
          'fabric-loader': '0.14.21',
          'quilt-loader': '0.19.2',
          neoforge: '20.4.109',
        },
        files: [],
      }

      const result = getInstanceConfigFromModrinthModpack(manifest)

      expect(result.name).toBe('Modrinth Pack-v1.2.3')
      expect(result.description).toBe('A great modpack')
      expect(result.runtime?.minecraft).toBe('1.19.2')
      expect(result.runtime?.forge).toBe('43.2.0')
      expect(result.runtime?.fabricLoader).toBe('0.14.21')
      expect(result.runtime?.quiltLoader).toBe('0.19.2')
      expect(result.runtime?.neoForged).toBe('20.4.109')
    })
  })

  describe('Instance to Modpack conversions', () => {
    const sampleInstance: InstanceData = {
      name: 'Test Instance',
      author: 'Test Author',
      description: 'Test Description',
      version: '1.19.2-forge-43.2.0',
      runtime: {
        minecraft: '1.19.2',
        forge: '43.2.0',
        fabricLoader: '0.14.21',
      },
      java: '/path/to/java',
      resolution: { width: 1920, height: 1080, fullscreen: false },
      minMemory: 2048,
      maxMemory: 8192,
      vmOptions: ['-Xmx8G'],
      mcOptions: ['--demo'],
      env: {},
      url: 'https://example.com',
      icon: 'icon.png',
      fileApi: 'https://api.example.com',
      server: null,
      showLog: true,
      hideLauncher: false,
      fastLaunch: false,
      disableElybyAuthlib: false,
      disableAuthlibInjector: false,
      useLatest: false,
      upstream: undefined,
      assignMemory: true,
      prependCommand: '',
      preExecuteCommand: '',
    }

    describe('getModrinthModpackFromInstance', () => {
      it('should convert instance to Modrinth modpack manifest', () => {
        const result = getModrinthModpackFromInstance(sampleInstance)

        expect(result.formatVersion).toBe(1)
        expect(result.game).toBe('minecraft')
        expect(result.versionId).toBe('')
        expect(result.name).toBe('Test Instance')
        expect(result.summary).toBe('Test Description')
        expect(result.dependencies.minecraft).toBe('1.19.2')
        expect(result.dependencies.forge).toBe('43.2.0')
        expect(result.dependencies['fabric-loader']).toBe('0.14.21')
        expect(result.files).toEqual([])
      })
    })

    describe('getCurseforgeModpackFromInstance', () => {
      it('should convert instance to CurseForge modpack manifest', () => {
        const result = getCurseforgeModpackFromInstance(sampleInstance)

        expect(result.manifestType).toBe('minecraftModpack')
        expect(result.manifestVersion).toBe(1)
        expect(result.name).toBe('Test Instance')
        expect(result.version).toBe('')
        expect(result.author).toBe('Test Author')
        expect(result.minecraft.version).toBe('1.19.2')
        expect(result.minecraft.modLoaders).toHaveLength(2)
        expect(result.minecraft.modLoaders[0]).toEqual({ id: 'forge-43.2.0', primary: true })
        expect(result.minecraft.modLoaders[1]).toEqual({ id: 'fabric-0.14.21', primary: true })
        expect(result.overrides).toBe('overrides')
        expect(result.files).toEqual([])
      })
    })

    describe('getMcbbsModpackFromInstance', () => {
      it('should convert instance to MCBBS modpack manifest', () => {
        const result = getMcbbsModpackFromInstance(sampleInstance)

        expect(result.manifestType).toBe('minecraftModpack')
        expect(result.manifestVersion).toBe(2)
        expect(result.name).toBe('Test Instance')
        expect(result.version).toBe('')
        expect(result.author).toBe('Test Author')
        expect(result.description).toBe('Test Description')
        expect(result.url).toBe('https://example.com')
        expect(result.addons).toContainEqual({ id: 'game', version: '1.19.2' })
        expect(result.addons).toContainEqual({ id: 'forge', version: '43.2.0' })
        expect(result.addons).toContainEqual({ id: 'fabric', version: '0.14.21' })
        expect(result.launchInfo?.minMemory).toBe(2048)
        expect(result.launchInfo?.launchArgument).toEqual(['--demo'])
        expect(result.launchInfo?.javaArgument).toEqual(['-Xmx8G'])
        expect(result.files).toEqual([])
      })

      it('should handle instance with no memory setting', () => {
        const instanceNoMemory = { ...sampleInstance, minMemory: 0 }
        const result = getMcbbsModpackFromInstance(instanceNoMemory)

        expect(result.launchInfo?.minMemory).toBe(0)
      })
    })
  })
})
