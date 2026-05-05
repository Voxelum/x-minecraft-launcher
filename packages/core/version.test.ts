import { join } from 'path'
import { describe, expect, test } from 'vitest'
import { getPlatform } from './platform'
import { LibraryInfo, ResolvedLibrary, Version } from './version'

describe('Version', () => {
  describe('#resolveFromPath', () => {
    test('should be able to infer from path', () => {
      const path = 'org/lwjgl/lwjgl-stb/3.2.1/lwjgl-stb-3.2.1.jar'
      const info = LibraryInfo.resolveFromPath(path)
      expect(info.path).toEqual(path)
      expect(info.groupId).toEqual('org.lwjgl')
      expect(info.artifactId).toEqual('lwjgl-stb')
      expect(info.version).toEqual('3.2.1')
      expect(info.name).toEqual('org.lwjgl:lwjgl-stb:3.2.1')
      expect(info.classifier).toEqual('')
      expect(info.type).toEqual('jar')
    })
    test('should be able to infer from path with classifier', () => {
      const path = 'org/lwjgl/lwjgl-stb/3.2.1/lwjgl-stb-3.2.1-javadoc.jar'
      const info = LibraryInfo.resolveFromPath(path)
      expect(info.path).toEqual(path)
      expect(info.groupId).toEqual('org.lwjgl')
      expect(info.artifactId).toEqual('lwjgl-stb')
      expect(info.version).toEqual('3.2.1')
      expect(info.name).toEqual('org.lwjgl:lwjgl-stb:3.2.1:javadoc')
      expect(info.classifier).toEqual('javadoc')
      expect(info.type).toEqual('jar')
    })
    test('should be able to infer from path with other file type', () => {
      const path = 'org/lwjgl/lwjgl-stb/3.2.1/lwjgl-stb-3.2.1-javadoc.zip'
      const info = LibraryInfo.resolveFromPath(path)
      expect(info.path).toEqual(path)
      expect(info.groupId).toEqual('org.lwjgl')
      expect(info.artifactId).toEqual('lwjgl-stb')
      expect(info.version).toEqual('3.2.1')
      expect(info.name).toEqual('org.lwjgl:lwjgl-stb:3.2.1:javadoc@zip')
      expect(info.classifier).toEqual('javadoc')
      expect(info.type).toEqual('zip')
    })
    test('should be able to infer from path with other file type and snapshot', () => {
      const path = 'org/lwjgl/lwjgl-stb/3.2.1/3.2.1-javadoc.zip'
      const info = LibraryInfo.resolveFromPath(path)
      expect(info.path).toEqual(path)
      expect(info.groupId).toEqual('org.lwjgl')
      expect(info.artifactId).toEqual('lwjgl-stb')
      expect(info.version).toEqual('3.2.1')
      expect(info.name).toEqual('org.lwjgl:lwjgl-stb:3.2.1:javadoc@zip')
      expect(info.classifier).toEqual('javadoc')
      expect(info.type).toEqual('zip')
      expect(info.isSnapshot).toEqual(true)
    })
  })
  describe('#getLibraryInfo', () => {
    test('should be able to parse normal minecraft library', () => {
      const name = 'com.mojang:patchy:1.1'
      const parsed = LibraryInfo.resolve(name)
      expect(parsed.groupId).toEqual('com.mojang')
      expect(parsed.artifactId).toEqual('patchy')
      expect(parsed.version).toEqual('1.1')
      expect(parsed.type).toEqual('jar')
      expect(parsed.isSnapshot).toEqual(false)
      expect(parsed.path).toEqual('com/mojang/patchy/1.1/patchy-1.1.jar')
    })

    test('should be able to parse strange forge library', () => {
      const name = 'net.minecraftforge:forge:1.14.3-27.0.47:universal'
      const parsed = LibraryInfo.resolve(name)
      expect(parsed.groupId).toEqual('net.minecraftforge')
      expect(parsed.artifactId).toEqual('forge')
      expect(parsed.version).toEqual('1.14.3-27.0.47')
      expect(parsed.classifier).toEqual('universal')
      expect(parsed.type).toEqual('jar')
      expect(parsed.isSnapshot).toEqual(false)
      expect(parsed.path).toEqual(
        'net/minecraftforge/forge/1.14.3-27.0.47/forge-1.14.3-27.0.47-universal.jar',
      )
    })

    test('should be able to parse strange forge resource', () => {
      const name = 'de.oceanlabs.mcp:mcp_config:1.14.3-20190624.152911@zip'
      const parsed = LibraryInfo.resolve(name)
      expect(parsed.groupId).toEqual('de.oceanlabs.mcp')
      expect(parsed.artifactId).toEqual('mcp_config')
      expect(parsed.version).toEqual('1.14.3-20190624.152911')
      expect(parsed.classifier).toEqual('')
      expect(parsed.type).toEqual('zip')
      expect(parsed.isSnapshot).toEqual(false)
      expect(parsed.path).toEqual(
        'de/oceanlabs/mcp/mcp_config/1.14.3-20190624.152911/mcp_config-1.14.3-20190624.152911.zip',
      )
    })

    test('should be able to parse normal minecraft library', () => {
      const name = 'com.mumfrey:liteloader:1.12.2-SNAPSHOT'
      const parsed = LibraryInfo.resolve(name)
      expect(parsed.groupId).toEqual('com.mumfrey')
      expect(parsed.artifactId).toEqual('liteloader')
      expect(parsed.version).toEqual('1.12.2-SNAPSHOT')
      expect(parsed.type).toEqual('jar')
      expect(parsed.isSnapshot).toEqual(true)
      expect(parsed.path).toEqual(
        'com/mumfrey/liteloader/1.12.2-SNAPSHOT/liteloader-1.12.2-SNAPSHOT.jar',
      )
    })
  })

  describe('#resolveLibraries', () => {
    test('should be able to resolve normal minecraft library', () => {
      const rawLib = {
        name: 'com.mojang:patchy:1.1',
        downloads: {
          artifact: {
            size: 15817,
            sha1: 'aef610b34a1be37fa851825f12372b78424d8903',
            path: 'com/mojang/patchy/1.1/patchy-1.1.jar',
            url: 'https://libraries.minecraft.net/com/mojang/patchy/1.1/patchy-1.1.jar',
          },
        },
      }

      const [resolved] = Version.resolveLibraries([rawLib], {
        name: 'osx',
        version: '',
        arch: 'x64',
      })
      expect(resolved.download).toEqual(rawLib.downloads.artifact)
      expect(resolved.checksums).toEqual(undefined)
      expect(resolved.serverreq).toEqual(undefined)
      expect(resolved.clientreq).toEqual(undefined)
      expect(resolved.name).toEqual(rawLib.name)
    })
    test('should be able to resolve legacy forge library', () => {
      const lib = {
        name: 'org.scala-lang.plugins:scala-continuations-library_2.11:1.0.2',
        url: 'http://files.minecraftforge.net/maven/',
        checksums: [
          '87213338cd5a153a7712cb574c0ddd2edfee0386',
          '0b4c1bf8d48993f138d6e10c0c144e50acfff581',
        ],
        serverreq: true,
        clientreq: true,
      }
      const [resolved] = Version.resolveLibraries([lib], { name: 'osx', version: '', arch: 'x64' })
      expect(resolved.name).toEqual(lib.name)
      expect(resolved.serverreq).toEqual(lib.serverreq)
      expect(resolved.clientreq).toEqual(lib.clientreq)
      expect(resolved.checksums).toEqual(lib.checksums)
      expect(resolved.download.sha1).toEqual(lib.checksums[0])
      expect(resolved.download.path).toEqual(
        'org/scala-lang/plugins/scala-continuations-library_2.11/1.0.2/scala-continuations-library_2.11-1.0.2.jar',
      )
    })
    test('should be able to filter out useless native library', () => {
      const lib = {
        name: 'org.lwjgl.lwjgl:lwjgl_util:2.9.4-nightly-20150209',
        rules: [
          {
            action: 'allow',
          },
          {
            action: 'disallow',
            os: {
              name: 'osx',
            },
          },
        ],
        downloads: {
          artifact: {
            size: 173887,
            sha1: 'd51a7c040a721d13efdfbd34f8b257b2df882ad0',
            path: 'org/lwjgl/lwjgl/lwjgl_util/2.9.4-nightly-20150209/lwjgl_util-2.9.4-nightly-20150209.jar',
            url: 'https://libraries.minecraft.net/org/lwjgl/lwjgl/lwjgl_util/2.9.4-nightly-20150209/lwjgl_util-2.9.4-nightly-20150209.jar',
          },
        },
      }
      const [onOsx] = Version.resolveLibraries([lib], { name: 'osx', version: '', arch: '64' })
      const [onWin] = Version.resolveLibraries([lib], { name: 'windows', version: '', arch: '64' })
      const [onLinux] = Version.resolveLibraries([lib], { name: 'linux', version: '', arch: '64' })
      expect(onOsx).toBeFalsy()
      expect(onWin).toBeTruthy()
      expect(onLinux).toBeTruthy()
    })
    test('should resolve 1.19 natives', () => {
      const selectionNative = {
        downloads: {
          artifact: {
            path: 'org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1-natives-windows.jar',
            sha1: '0036c37f16ab611b3aa11f3bcf80b1d509b4ce6b',
            size: 159361,
            url: 'https://libraries.minecraft.net/org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1-natives-windows.jar',
          },
        },
        name: 'org.lwjgl:lwjgl:3.3.1:natives-windows',
        rules: [
          {
            action: 'allow',
            os: {
              name: 'windows',
            },
          },
        ],
      }

      const [onOsx] = Version.resolveLibraries([selectionNative], {
        name: 'osx',
        version: '',
        arch: '64',
      })
      const [onWin] = Version.resolveLibraries([selectionNative], {
        name: 'windows',
        version: '',
        arch: '64',
      })
      const [onLinux] = Version.resolveLibraries([selectionNative], {
        name: 'linux',
        version: '',
        arch: '64',
      })
      expect(onOsx).toBeUndefined()
      expect(onWin).toBeInstanceOf(ResolvedLibrary)
      expect(onWin.isNative).toBeFalsy()
      expect(onLinux).toBeUndefined()
    })
    test('should be able to select correct native library by system', () => {
      const selectionNative = {
        extract: {
          exclude: ['META-INF/'],
        },
        name: 'net.java.jinput:jinput-platform:2.0.5',
        natives: {
          linux: 'natives-linux',
          osx: 'natives-osx',
          windows: 'natives-windows',
        },
        downloads: {
          classifiers: {
            'natives-linux': {
              size: 10362,
              sha1: '7ff832a6eb9ab6a767f1ade2b548092d0fa64795',
              path: 'net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-linux.jar',
              url: 'https://libraries.minecraft.net/net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-linux.jar',
            },
            'natives-osx': {
              size: 12186,
              sha1: '53f9c919f34d2ca9de8c51fc4e1e8282029a9232',
              path: 'net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-osx.jar',
              url: 'https://libraries.minecraft.net/net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-osx.jar',
            },
            'natives-windows': {
              size: 155179,
              sha1: '385ee093e01f587f30ee1c8a2ee7d408fd732e16',
              path: 'net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-windows.jar',
              url: 'https://libraries.minecraft.net/net/java/jinput/jinput-platform/2.0.5/jinput-platform-2.0.5-natives-windows.jar',
            },
          },
        },
      }

      const [onOsx] = Version.resolveLibraries([selectionNative], {
        name: 'osx',
        version: '',
        arch: '64',
      })
      const [onWin] = Version.resolveLibraries([selectionNative], {
        name: 'windows',
        version: '',
        arch: '64',
      })
      const [onLinux] = Version.resolveLibraries([selectionNative], {
        name: 'linux',
        version: '',
        arch: '64',
      })
      expect(onWin.isNative).toBeTruthy()
      expect(onOsx.isNative).toBeTruthy()
      expect(onLinux.isNative).toBeTruthy()

      expect(onOsx.download).toEqual(selectionNative.downloads.classifiers['natives-osx'])
      expect(onWin.download).toEqual(selectionNative.downloads.classifiers['natives-windows'])
      expect(onLinux.download).toEqual(selectionNative.downloads.classifiers['natives-linux'])
    })
    test('should correct work on mixture case of selection & rule', () => {
      const lib = {
        extract: {
          exclude: ['META-INF/'],
        },
        name: 'ca.weblite:java-objc-bridge:1.0.0',
        natives: {
          osx: 'natives-osx',
        },
        rules: [
          {
            action: 'allow',
            os: {
              name: 'osx',
            },
          },
        ],
        downloads: {
          classifiers: {
            'natives-osx': {
              size: 5629,
              sha1: '08befab4894d55875f33c3d300f4f71e6e828f64',
              path: 'ca/weblite/java-objc-bridge/1.0.0/java-objc-bridge-1.0.0-natives-osx.jar',
              url: 'https://libraries.minecraft.net/ca/weblite/java-objc-bridge/1.0.0/java-objc-bridge-1.0.0-natives-osx.jar',
            },
          },
          artifact: {
            size: 40502,
            sha1: '6ef160c3133a78de015830860197602ca1c855d3',
            path: 'ca/weblite/java-objc-bridge/1.0.0/java-objc-bridge-1.0.0.jar',
            url: 'https://libraries.minecraft.net/ca/weblite/java-objc-bridge/1.0.0/java-objc-bridge-1.0.0.jar',
          },
        },
      }

      const [onOsx] = Version.resolveLibraries([lib], { name: 'osx', version: '', arch: '64' })
      const [onWin] = Version.resolveLibraries([lib], { name: 'windows', version: '', arch: '64' })
      const [onLinux] = Version.resolveLibraries([lib], { name: 'linux', version: '', arch: '64' })
      expect(onOsx.isNative).toBeTruthy()
      expect(onWin).toBeUndefined()
      expect(onLinux).toBeUndefined()

      expect(onOsx.download).toEqual(lib.downloads.classifiers['natives-osx'])
    })
    test('should be able to handle the case with arch', () => {
      const lib = {
        downloads: {
          classifiers: {
            'natives-windows-32': {
              path: 'tv/twitch/twitch-external-platform/4.5/twitch-external-platform-4.5-natives-windows-32.jar',
              sha1: '18215140f010c05b9f86ef6f0f8871954d2ccebf',
              size: 5654047,
              url: 'https://libraries.minecraft.net/tv/twitch/twitch-external-platform/4.5/twitch-external-platform-4.5-natives-windows-32.jar',
            },
            'natives-windows-64': {
              path: 'tv/twitch/twitch-external-platform/4.5/twitch-external-platform-4.5-natives-windows-64.jar',
              sha1: 'c3cde57891b935d41b6680a9c5e1502eeab76d86',
              size: 7457619,
              url: 'https://libraries.minecraft.net/tv/twitch/twitch-external-platform/4.5/twitch-external-platform-4.5-natives-windows-64.jar',
            },
          },
        },
        extract: {
          exclude: ['META-INF/'],
        },
        name: 'tv.twitch:twitch-external-platform:4.5',
        natives: {
          // eslint-disable-next-line no-template-curly-in-string
          windows: 'natives-windows-${arch}',
        },
        rules: [
          {
            action: 'allow',
            os: {
              name: 'windows',
            },
          },
        ],
      }

      const [onOsx] = Version.resolveLibraries([lib], { name: 'osx', version: '', arch: 'x64' })
      const [onWin] = Version.resolveLibraries([lib], { name: 'windows', version: '', arch: 'x64' })
      const [onWin32] = Version.resolveLibraries([lib], {
        name: 'windows',
        version: '',
        arch: 'x32',
      })
      const [onLinux] = Version.resolveLibraries([lib], { name: 'linux', version: '', arch: 'x64' })
      expect(onOsx).toBeUndefined()
      expect(onWin.isNative).toBeTruthy()
      expect(onWin32.isNative).toBeTruthy()
      expect(onLinux).toBeUndefined()

      expect(onWin.download).toEqual(lib.downloads.classifiers['natives-windows-64'])
      expect(onWin32.download).toEqual(lib.downloads.classifiers['natives-windows-32'])
    })
  })
  describe('#mixinArgumentString', () => {
    test('should be able to mixin the version string', () => {
      // eslint-disable-next-line no-template-curly-in-string
      const s = Version.mixinArgumentString(
        '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}',
        '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker --versionType Forge',
      )
      // eslint-disable-next-line no-template-curly-in-string
      expect(s).toEqual(
        '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker --username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}',
      )
    })
  })

  describe('#parse', () => {
    test('should throw if no main class', async ({ mock }) => {
      await expect(Version.parse(mock, 'no-main-class')).rejects.toEqual(
        Object.assign(new Error(), {
          name: 'BadVersionJson',
          error: 'BadVersionJson',
          missing: 'MainClass',
          version: 'no-main-class',
        }),
      )
    })
    test('should not throw if no asset json', async ({ mock }) => {
      await expect(Version.parse(mock, 'no-assets-json')).resolves
    })
    test('should not throw if no downloads', async ({ mock }) => {
      await expect(Version.parse(mock, 'no-downloads')).resolves
    })
    test('should be able to parse 1.17.10 version', async ({ mock }) => {
      const version = await Version.parse(mock, '1.7.10')
      expect(version.id).toEqual('1.7.10')
      expect(version.mainClass).toBeTruthy()
      expect(version.libraries).toBeInstanceOf(Array)
      expect(version.arguments).toBeTruthy()
      expect(version.arguments.game).toBeInstanceOf(Array)
      expect(version.arguments.jvm).toBeInstanceOf(Array)
      expect(version.minecraftDirectory).toEqual(mock)
      expect(version.minecraftVersion).toEqual('1.7.10')
      expect(version.inheritances).toEqual(['1.7.10'])
    })
    test('should be able to throw if version not existed', async ({ mock }) => {
      await expect(Version.parse(mock, '1.12')).rejects.toMatchObject({
        error: 'MissingVersionJson',
        version: '1.12',
        path: join(mock, 'versions', '1.12', '1.12.json'),
      })
    })
    test('should be able to parse extended profile for forge', async ({ mock }) => {
      const version = await Version.parse(mock, '1.7.10-Forge10.13.3.1400-1.7.10')
      expect(version.id).toEqual('1.7.10-Forge10.13.3.1400-1.7.10')
      expect(version.mainClass).toEqual('net.minecraft.launchwrapper.Launch')
      expect(version.libraries).toBeInstanceOf(Array)
      expect(version.arguments).toBeTruthy()
      expect(version.arguments.game).toBeInstanceOf(Array)
      expect(version.arguments.jvm).toBeInstanceOf(Array)
      expect(version.minecraftDirectory).toEqual(mock)
      expect(version.minecraftVersion).toEqual('1.7.10')
      expect(version.inheritances).toEqual(['1.7.10-Forge10.13.3.1400-1.7.10', '1.7.10'])
    })
    test.skip('should be able to parse extends version for forge & liteloader', async function ({
      temp,
    }) {
      const version = await Version.parse(
        temp,
        '1.12.2-forge-14.23.5.2852-Liteloader1.12.2-1.12.2-SNAPSHOT',
      )
      expect(version).toBeTruthy()
      expect(version.pathChain).toBeInstanceOf(Array)
      expect(version.pathChain).toHaveLength(3)
      expect(version.minecraftVersion).toEqual('1.12.2')
      expect(version.inheritances).toEqual([
        '1.12.2-forge-14.23.5.2852-Liteloader1.12.2-1.12.2-SNAPSHOT',
        '1.12.2-forge-14.23.5.2852',
        '1.12.2',
      ])
    })
  })

  describe('#checkAllowed', () => {
    const currentPlatform = getPlatform()
    test('should be able to handle empty rules', () => {
      expect(Version.checkAllowed([])).toBeTruthy()
    })
    test('should be able to handle featured rules', () => {
      expect(
        Version.checkAllowed(
          [
            {
              action: 'allow',
              features: {
                is_demo_user: true,
              },
            },
          ],
          currentPlatform,
          ['is_demo_user'],
        ),
      ).toBeTruthy()
    })
    test('should be able to handle featured rules with flag false', () => {
      expect(
        Version.checkAllowed(
          [
            {
              action: 'allow',
              features: {
                is_demo_user: false,
              },
            },
          ],
          currentPlatform,
          [''],
        ),
      ).toBeTruthy()
    })
  })

  describe('#mixinArgumentString', () => {
    test('should be able to mixin the version string', () => {
      // eslint-disable-next-line no-template-curly-in-string
      const s = Version.mixinArgumentString(
        '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}',
        '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker --versionType Forge',
      )
      // eslint-disable-next-line no-template-curly-in-string
      expect(s).toEqual(
        '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker --username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userType ${user_type} --versionType ${version_type}',
      )
    })
  })

  // it("should be able to extends the version", async function () {
  //     const ver = await Version.parse(this.gameDirectory, "1.12.2-Liteloader1.12.2-1.12.2-SNAPSHOT");
  //     const ver2 = await Version.parse(this.gameDirectory, "1.12.2-forge-14.23.5.2852");

  //     const out = Version.extendsVersion("test", ver, ver2);
  //     assert(out);
  // });
})
