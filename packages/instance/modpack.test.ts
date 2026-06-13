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

    it('should import per-instance commands when OverrideCommands=true (gh #1386)', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [{ uid: 'net.minecraft', version: '1.20.1' }],
        },
        cfg: {
          name: 'Pack With Commands',
          notes: '',
          OverrideCommands: 'true',
          PreLaunchCommand: 'echo hello && sync',
          WrapperCommand: 'prime-run env LIBVA_DRIVER_NAME=radeonsi',
          PostExitCommand: 'echo bye',
          JvmArgs: '-XX:+UseG1GC -Dfile.encoding=UTF-8',
          MinMemAlloc: '1024',
          MaxMemAlloc: '4096',
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.preExecuteCommand).toBe('echo hello && sync')
      // Wrapper command containing '=' must be preserved verbatim.
      expect(result.prependCommand).toBe('prime-run env LIBVA_DRIVER_NAME=radeonsi')
      expect(result.vmOptions).toEqual(['-XX:+UseG1GC', '-Dfile.encoding=UTF-8'])
      expect(result.minMemory).toBe(1024)
      expect(result.maxMemory).toBe(4096)
    })

    it('should ignore per-instance commands when OverrideCommands is not enabled (gh #1386)', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [{ uid: 'net.minecraft', version: '1.20.1' }],
        },
        cfg: {
          name: 'Pack With Commands',
          notes: '',
          PreLaunchCommand: 'echo hello',
          WrapperCommand: 'prime-run',
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.preExecuteCommand).toBeUndefined()
      expect(result.prependCommand).toBeUndefined()
    })

    it('should merge `+jvmArgs` from Prism component patches into vmOptions', () => {
      // Reproduces the GTNH 2.8.4 layout: lwjgl3ify ships its `--add-opens`
      // set out-of-line under `patches/me.eigenraven.lwjgl3ify.forgepatches.json`.
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [
            { uid: 'net.minecraft', version: '1.7.10' },
            { uid: 'me.eigenraven.lwjgl3ify.forgepatches', version: '2.1.16' },
            { uid: 'net.minecraftforge', version: '10.13.4.1614' },
          ],
        },
        cfg: { name: 'GTNH', notes: '', JvmArgs: '-Xmx8G' },
        patches: {
          'me.eigenraven.lwjgl3ify.forgepatches': {
            uid: 'me.eigenraven.lwjgl3ify.forgepatches',
            '+jvmArgs': [
              '-Dfile.encoding=UTF-8',
              '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
            ],
          },
          'net.minecraft': {
            uid: 'net.minecraft',
            // Patches without `+jvmArgs` must not break the merge.
          },
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      // cfg JvmArgs precede patch args so user-level tweaks stay first.
      expect(result.vmOptions).toEqual([
        '-Xmx8G',
        '-Dfile.encoding=UTF-8',
        '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
      ])
    })

    it('should merge `+jvmArgs` in component (declared) order across patches', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [
            { uid: 'net.minecraft', version: '1.20.1' },
            { uid: 'a.first', version: '1' },
            { uid: 'b.second', version: '1' },
          ],
        },
        cfg: { name: 'Order', notes: '' },
        patches: {
          'b.second': { uid: 'b.second', '+jvmArgs': ['-Bsecond'] },
          'a.first': { uid: 'a.first', '+jvmArgs': ['-Afirst'] },
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.vmOptions).toEqual(['-Afirst', '-Bsecond'])
    })

    it('should translate `+tweakers` into Minecraft `--tweakClass` args', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [
            { uid: 'net.minecraft', version: '1.7.10' },
            { uid: 'net.minecraftforge', version: '10.13.4.1614' },
          ],
        },
        cfg: { name: 'Legacy', notes: '' },
        patches: {
          'net.minecraftforge': {
            uid: 'net.minecraftforge',
            '+tweakers': [
              'cpw.mods.fml.common.launcher.FMLTweaker',
              'optifine.OptiFineForgeTweaker',
            ],
          },
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.mcOptions).toEqual([
        '--tweakClass', 'cpw.mods.fml.common.launcher.FMLTweaker',
        '--tweakClass', 'optifine.OptiFineForgeTweaker',
      ])
    })

    it('should leave vmOptions / mcOptions undefined when patches contribute nothing', () => {
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [{ uid: 'net.minecraft', version: '1.20.1' }],
        },
        cfg: { name: 'Plain', notes: '' },
        patches: {
          'net.minecraft': { uid: 'net.minecraft' },
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.vmOptions).toBeUndefined()
      expect(result.mcOptions).toBeUndefined()
    })

    it('should ignore patches whose uid does not appear in mmc-pack.json components', () => {
      // Defensive: a stale patch file left in the zip should not leak args.
      const manifest: MMCModpackManifest = {
        json: {
          formatVersion: 1,
          components: [{ uid: 'net.minecraft', version: '1.20.1' }],
        },
        cfg: { name: 'Stale', notes: '' },
        patches: {
          'stale.uid': { uid: 'stale.uid', '+jvmArgs': ['-Dleaked=true'] },
        },
      }

      const result = getInstanceConfigFromMmcModpack(manifest)

      expect(result.vmOptions).toBeUndefined()
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

    it('should throw InvalidCurseforgeModpackManifestError when minecraft block is missing', () => {
      // Telemetry: 0.56.7 bucket
      // "TypeError at Object.getInstanceConfigFromCurseforgeModpack: Cannot
      // read properties of undefined (reading 'modLoaders')". Surface a typed
      // error so the upstream caller can convert it to a UI Exception.
      const manifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        name: 'Broken Pack',
        version: '1.0.0',
        author: 'Author',
        overrides: 'overrides',
      } as unknown as CurseforgeModpackManifest

      expect(() => getInstanceConfigFromCurseforgeModpack(manifest)).toThrow(/minecraft\.modLoaders/)
      try {
        getInstanceConfigFromCurseforgeModpack(manifest)
      } catch (e) {
        expect((e as Error).name).toBe('InvalidCurseforgeModpackManifestError')
      }
    })

    it('should throw InvalidCurseforgeModpackManifestError when modLoaders is not an array', () => {
      const manifest = {
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        name: 'Broken Pack',
        version: '1.0.0',
        author: 'Author',
        minecraft: { version: '1.20.1' },
        overrides: 'overrides',
      } as unknown as CurseforgeModpackManifest

      expect(() => getInstanceConfigFromCurseforgeModpack(manifest)).toThrow(/minecraft\.modLoaders/)
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
