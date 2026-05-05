import { describe, it, expect } from 'vitest'
import { type VanillaProfile, type VanillaProfiles } from './vanilla_parser'

describe('Vanilla Parser', () => {
  describe('Type Definitions', () => {
    describe('VanillaProfile', () => {
      it('should have proper profile structure', () => {
        const profile: VanillaProfile = {
          name: 'Test Profile',
          type: 'custom',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-02T00:00:00.000Z',
          icon: 'default',
          lastVersionId: '1.19.2',
          gameDir: '/path/to/game',
          javaArgs: '-Xmx4G -Xms2G',
          javaDir: '/path/to/java',
          resolution: {
            width: 1920,
            height: 1080,
          },
        }

        expect(profile.name).toBe('Test Profile')
        expect(profile.type).toBe('custom')
        expect(profile.lastVersionId).toBe('1.19.2')
        expect(profile.gameDir).toBe('/path/to/game')
        expect(profile.javaArgs).toBe('-Xmx4G -Xms2G')
        expect(profile.javaDir).toBe('/path/to/java')
        expect(profile.resolution?.width).toBe(1920)
        expect(profile.resolution?.height).toBe(1080)
      })

      it('should support minimal profile configuration', () => {
        const profile: VanillaProfile = {
          name: 'Minimal Profile',
          type: 'latest-release',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: 'latest-release',
        }

        expect(profile.name).toBe('Minimal Profile')
        expect(profile.type).toBe('latest-release')
        expect(profile.lastVersionId).toBe('latest-release')
        expect(profile.gameDir).toBeUndefined()
        expect(profile.javaArgs).toBeUndefined()
        expect(profile.resolution).toBeUndefined()
      })
    })

    describe('VanillaProfiles', () => {
      it('should have proper profiles structure', () => {
        const profiles: VanillaProfiles = {
          profiles: {
            'profile-1': {
              name: 'Vanilla 1.19.2',
              type: 'custom',
              created: '2023-01-01T00:00:00.000Z',
              lastUsed: '2023-01-02T00:00:00.000Z',
              icon: 'default',
              lastVersionId: '1.19.2',
            },
            'profile-2': {
              name: 'Latest Release',
              type: 'latest-release',
              created: '2023-01-01T00:00:00.000Z',
              lastUsed: '2023-01-01T00:00:00.000Z',
              icon: 'default',
              lastVersionId: 'latest-release',
              gameDir: '/custom/game/dir',
              javaArgs: '-Xmx8G',
            },
          },
          settings: {
            crashAssistance: true,
            enableAdvanced: false,
            enableAnalytics: true,
            enableHistorical: false,
            enableReleases: true,
            enableSnapshots: false,
            keepLauncherOpen: false,
            profileSorting: 'byName',
            showGameLog: true,
            showMenu: true,
            soundOn: true,
          },
          version: 3,
        }

        expect(Object.keys(profiles.profiles)).toHaveLength(2)
        expect(profiles.profiles['profile-1'].name).toBe('Vanilla 1.19.2')
        expect(profiles.profiles['profile-2'].name).toBe('Latest Release')
        expect(profiles.settings.enableReleases).toBe(true)
        expect(profiles.version).toBe(3)
      })

      it('should handle minimal profiles structure', () => {
        const profiles: VanillaProfiles = {
          profiles: {},
          settings: {
            crashAssistance: false,
            enableAdvanced: false,
            enableAnalytics: false,
            enableHistorical: false,
            enableReleases: true,
            enableSnapshots: false,
            keepLauncherOpen: false,
            profileSorting: 'alphabetically',
            showGameLog: false,
            showMenu: false,
            soundOn: false,
          },
          version: 3,
        }

        expect(Object.keys(profiles.profiles)).toHaveLength(0)
        expect(profiles.settings.enableReleases).toBe(true)
        expect(profiles.version).toBe(3)
      })
    })
  })

  describe('Profile Configuration', () => {
    it('should support different profile types', () => {
      const types = ['custom', 'latest-release', 'latest-snapshot']

      types.forEach((type) => {
        const profile: VanillaProfile = {
          name: `${type} Profile`,
          type,
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: type === 'custom' ? '1.19.2' : type,
        }

        expect(profile.type).toBe(type)
        expect(profile.name).toBe(`${type} Profile`)
      })
    })

    it('should support various Java arguments', () => {
      const javaArgs = [
        '-Xmx4G -Xms2G',
        '-Xmx8G -Xms4G -XX:+UseG1GC',
        '-Xmx2G -Dfile.encoding=UTF-8',
        '-server -Xmx6G -XX:+UnlockExperimentalVMOptions',
      ]

      javaArgs.forEach((args) => {
        const profile: VanillaProfile = {
          name: 'Java Args Test',
          type: 'custom',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: '1.19.2',
          javaArgs: args,
        }

        expect(profile.javaArgs).toBe(args)
      })
    })

    it('should support different resolutions', () => {
      const resolutions = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 2560, height: 1440 },
        { width: 854, height: 480 },
      ]

      resolutions.forEach((res) => {
        const profile: VanillaProfile = {
          name: 'Resolution Test',
          type: 'custom',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: '1.19.2',
          resolution: res,
        }

        expect(profile.resolution).toEqual(res)
      })
    })
  })

  describe('Version Handling', () => {
    it('should support various Minecraft versions', () => {
      const versions = ['1.19.2', '1.20.1', '1.18.2', '23w31a', 'latest-release', 'latest-snapshot']

      versions.forEach((version) => {
        const profile: VanillaProfile = {
          name: `Version ${version}`,
          type: version.includes('latest') ? (version as any) : 'custom',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: version,
        }

        expect(profile.lastVersionId).toBe(version)
      })
    })
  })

  describe('Path Handling', () => {
    it('should handle different game directory paths', () => {
      const paths = [
        '/home/user/.minecraft',
        'C:\\Users\\User\\AppData\\Roaming\\.minecraft',
        '/custom/minecraft/path',
        'relative/path/to/minecraft',
      ]

      paths.forEach((path) => {
        const profile: VanillaProfile = {
          name: 'Path Test',
          type: 'custom',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: '1.19.2',
          gameDir: path,
        }

        expect(profile.gameDir).toBe(path)
      })
    })

    it('should handle different Java directory paths', () => {
      const javaPaths = [
        '/usr/lib/jvm/java-17-openjdk',
        'C:\\Program Files\\Java\\jdk-17',
        '/opt/java/openjdk',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.7.7-hotspot',
      ]

      javaPaths.forEach((javaPath) => {
        const profile: VanillaProfile = {
          name: 'Java Path Test',
          type: 'custom',
          created: '2023-01-01T00:00:00.000Z',
          lastUsed: '2023-01-01T00:00:00.000Z',
          icon: 'default',
          lastVersionId: '1.19.2',
          javaDir: javaPath,
        }

        expect(profile.javaDir).toBe(javaPath)
      })
    })
  })
})
