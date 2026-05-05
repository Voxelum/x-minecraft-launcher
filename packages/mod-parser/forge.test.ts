import * as path from 'path'
import { readForgeMod, readForgeModToml } from './forge'
import { ForgeConfig } from './forgeConfig'
import { describe, test, expect } from 'vitest'
import { openFileSystem } from '@xmcl/system'

describe('Forge', () => {
  test('should identify the package usage', async ({ mock }) => {
    const {
      usedForgePackage,
      usedLegacyFMLPackage,
      usedMinecraftClientPackage,
      usedMinecraftPackage,
    } = await readForgeMod(`${mock}/mods/sample-mod.jar`)
    expect(usedForgePackage).toBeFalsy()
    expect(usedLegacyFMLPackage).toBeTruthy()
    expect(usedMinecraftClientPackage).toBeFalsy()
    expect(usedMinecraftPackage).toBeTruthy()
  })

  test('should not crash if the toml does not have the dependencies', async ({ mock }) => {
    const metadata = await readForgeModToml(`${mock}/mods/sample-mod-1.13-no-deps.jar`)
    // eslint-disable-next-line no-template-curly-in-string
    expect(metadata).toEqual([
      {
        authors: 'mezz',
        credits: '',
        dependencies: [],
        description:
          'JEI is an item and recipe viewing mod for Minecraft, built from the ground up for stability and performance.\n',
        displayName: 'Just Enough Items',
        displayURL: 'https://minecraft.curseforge.com/projects/jei',
        issueTrackerURL: 'https://github.com/mezz/JustEnoughItems/issues?q=is%3Aissue',
        loaderVersion: '[14,)',
        logoFile: '',
        modLoader: 'javafml',
        modid: 'jei',
        provides: [],
        updateJSONURL: '',
        version: '${file.jarVersion}',
        clientSideOnly: false,
      },
    ])
  })

  test('should read if the mod is client side only', async ({ mock }) => {
    const metadata = await readForgeModToml(`${mock}/mods/sample-mod-1.13-no-deps-client-only.jar`)
    expect(metadata).toEqual([
      {
        authors: 'mezz',
        credits: '',
        dependencies: [],
        description:
          'JEI is an item and recipe viewing mod for Minecraft, built from the ground up for stability and performance.\n',
        displayName: 'Just Enough Items',
        displayURL: 'https://minecraft.curseforge.com/projects/jei',
        issueTrackerURL: 'https://github.com/mezz/JustEnoughItems/issues?q=is%3Aissue',
        loaderVersion: '[14,)',
        logoFile: '',
        modLoader: 'javafml',
        modid: 'jei',
        provides: [],
        updateJSONURL: '',
        version: '${file.jarVersion}',
        clientSideOnly: true,
      },
    ])
  })

  test('should read >1.13 forge mod jar', async ({ mock }) => {
    const metadata = await readForgeMod(`${mock}/mods/sample-mod-1.13.jar`)
    expect(metadata).toEqual({
      manifest: {
        'Manifest-Version': '1.0',
        'Implementation-Timestamp': '2019-12-02T06',
        'Implementation-Title': 'jei-1.14.4',
        'Implementation-Vendor': 'mezz',
        'Implementation-Version': '6.0.0.26',
        'Specification-Title': 'Just Enough Items',
        'Specification-Vendor': 'mezz',
        'Specification-Version': '6.0.0',
      },
      manifestMetadata: undefined,
      mcmodInfo: [],
      modAnnotations: [
        {
          acceptableRemoteVersions: '',
          acceptableSaveVersions: '',
          acceptedMinecraftVersions: '',
          clientSideOnly: false,
          dependencies: '',
          modLanguage: 'java',
          modLanguageAdapter: '',
          modid: 'jei',
          name: '',
          serverSideOnly: false,
          useMetadata: true,
          value: '',
          version: '',
        },
      ],
      modsToml: [
        {
          authors: 'mezz',
          credits: '',
          dependencies: [
            {
              mandatory: true,
              modId: 'forge',
              ordering: 'NONE',
              side: 'BOTH',
              versionRange: '[28.1.0,)',
            },
          ],
          description:
            'JEI is an item and recipe viewing mod for Minecraft, built from the ground up for stability and performance.\n',
          displayName: 'Just Enough Items',
          displayURL: 'https://minecraft.curseforge.com/projects/jei',
          logoFile: '',
          modid: 'jei',
          provides: [],
          updateJSONURL: '',
          issueTrackerURL: 'https://github.com/mezz/JustEnoughItems/issues?q=is%3Aissue',
          modLoader: 'javafml',
          loaderVersion: '[14,)',
          version: '6.0.0.26',
          clientSideOnly: false,
        },
      ],
      usedForgePackage: true,
      usedLegacyFMLPackage: false,
      usedMinecraftClientPackage: false,
      usedMinecraftPackage: true,
    })
  })

  test('should read mcmod.info in jar', async ({ mock }) => {
    const { mcmodInfo } = await readForgeMod(`${mock}/mods/sample-mod.jar`)
    expect(
      mcmodInfo.some(
        (m) =>
          m.modid === 'soundfilters' &&
          m.name === 'Sound Filters' &&
          m.description ===
            'Adds reveb to caves, as well as muted sounds underwater/in lava, and behind walls.' &&
          m.version === '0.8_for_1,8' &&
          m.mcversion === '1.8' &&
          m.credits === 'Made by Tmtravlr.',
      ),
    ).toBeTruthy()
  })

  test('should read ccc mod plugin in jar', async ({ mock }) => {
    const { mcmodInfo } = await readForgeMod(`${mock}/mods/sample-ccc-mod.jar`)
    expect(mcmodInfo.length).toEqual(1)
  })

  test('should read nei mod plugin in jar', async ({ mock }) => {
    const { mcmodInfo } = await readForgeMod(`${mock}/mods/sample-nei-mod.jar`)
    expect(mcmodInfo.length).toEqual(1)
  })

  test('should read tweak class in jar', async ({ mock }) => {
    const { manifestMetadata } = await readForgeMod(`${mock}/mods/tweak-class.jar`)
    expect(manifestMetadata).toEqual({
      modid: 'betterfps',
      name: 'BetterFps',
      authors: ['Guichaguri'],
      version: '1.4.8',
      description: 'Performance Improvements',
      url: 'http://guichaguri.github.io/BetterFps/',
    })
  })

  test('should read dummy mod in jar', async ({ mock }) => {
    const metadata = await readForgeMod(`${mock}/mods/dummy-mod.jar`)
    expect(metadata).toEqual({
      manifest: {
        FMLCorePlugin: 'io.prplz.mousedelayfix.FMLLoadingPlugin',
        'Manifest-Version': '1.0',
      },
      mcmodInfo: [],
      modAnnotations: [
        {
          acceptableRemoteVersions: '',
          acceptableSaveVersions: '',
          acceptedMinecraftVersions: '',
          clientSideOnly: false,
          dependencies: '',
          modLanguage: 'java',
          modLanguageAdapter: '',
          modid: 'mousedelayfix',
          name: 'MouseDelayFix',
          serverSideOnly: false,
          useMetadata: false,
          value: '',
          version: '1.0',
        },
      ],
      modsToml: [],
      usedForgePackage: true,
      usedLegacyFMLPackage: false,
      usedMinecraftClientPackage: false,
      usedMinecraftPackage: true,
    })
  })

  test('should read @Mod in jar', async ({ mock }) => {
    const { modAnnotations } = await readForgeMod(`${mock}/mods/sample-mod.jar`)
    expect(
      modAnnotations.some((m) => m.modid === 'NuclearCraft' && m.version === '1.9e'),
    ).toBeTruthy()
  })

  test('should not close if the fs is the input', async ({ mock }) => {
    const fs = await openFileSystem(path.join(mock, 'mods', 'sample-mod.jar'))
    await readForgeMod(fs)
    expect(fs.isClosed()).toBe(false)
  })

  test('should detect optifine from class in jar', async ({ mock }) => {
    const { modAnnotations } = await readForgeMod(`${mock}/mods/sample-mod.jar`)
    expect(
      modAnnotations.some(
        (m) =>
          m.modid === 'OptiFine' &&
          m.name === 'OptiFine' &&
          m.description ===
            'OptiFine is a Minecraft optimization mod. It allows Minecraft to run faster and look better with full support for HD textures and many configuration options.' &&
          m.version === 'HD_U_C5' &&
          m.mcversion === '1.12.1' &&
          m.url === 'https://optifine.net',
      ),
    ).toBeTruthy()
  })

  test('should not read the fabric mod', async ({ mock }) => {
    await expect(readForgeMod(path.join(mock, 'mods', 'fabric-sample-2.jar'))).rejects.toBeTruthy()
  })

  describe('Config', () => {
    const cfg1 = `
    # Configuration file

    tweaks {
        # Replace the FML test config GUI with a working GUI.
        B:replaceInGameConfig=true
    }


    versioncheck {
        # Should the mod check for updates?
        B:checkForUpdates=true

        # A list of known updates. Deleting versions from the list will remind you about them again.
        S:knownVersions <
            InGameInfoXML 2.8.1.82
            LunatriusCore 1.1.2.21
         >

        # Should the mod remind you only for new updates (once per version)?
        B:silenceKnownUpdates=false

        I:someInt=1
        D:someDouble=0.1
    }
    `
    let config: ForgeConfig
    test('forge config parsing', () => {
      config = ForgeConfig.parse(cfg1)
    })
    test('forge config categories parsing', () => {
      expect(config.versioncheck).toBeTruthy()
      expect(config.tweaks).toBeTruthy()
    })
    test('forge config property parsing', () => {
      expect(config.tweaks.properties[0].name).toEqual('replaceInGameConfig')
      expect(config.tweaks.properties[0].comment).toEqual(
        'Replace the FML test config GUI with a working GUI.',
      )
      expect(config.tweaks.properties[0].type).toEqual('B')
    })
    test('forge config multiple properties parsing', () => {
      expect(config.versioncheck.properties[0].name).toEqual('checkForUpdates')
      expect(config.versioncheck.properties[1].name).toEqual('knownVersions')
      expect(config.versioncheck.properties[1].value[0]).toEqual('InGameInfoXML 2.8.1.82')
      expect(config.versioncheck.properties[1].value[1]).toEqual('LunatriusCore 1.1.2.21')
      expect(config.versioncheck.properties[2].name).toEqual('silenceKnownUpdates')
      expect(config.versioncheck.properties[0].type).toEqual('B')
      expect(config.versioncheck.properties[1].type).toEqual('S')
      expect(config.versioncheck.properties[2].type).toEqual('B')
    })
    test('should stringify the config', () => {
      const string = ForgeConfig.stringify(config)
      expect(
        string
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length !== 0),
      ).toEqual(
        cfg1
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length !== 0),
      )
    })
  })
})
