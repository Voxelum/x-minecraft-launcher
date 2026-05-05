import assert from 'assert'
import { spawnSync } from 'child_process'
import { EOL } from 'os'
import * as path from 'path'
import {
  DEFAULT_EXTRA_JVM_ARGS,
  generateArguments,
  generateArgumentsServer,
  createQuickPlayMultiplayer,
} from './launch'
import { describe, test, expect } from 'vitest'

const normalize = (p: string) => p.replaceAll('\\', '/')

function getJavaVersion(javaPath: string) {
  const { stderr } = spawnSync(javaPath, ['-version'], { encoding: 'utf8' })
  const line = stderr.split(EOL)[0]
  if (stderr.startsWith('java version')) {
    const parts = line.split(' ')[2].replace(/"/g, '').split('.')
    if (parts[0] === '1') {
      return Number.parseInt(parts[1].replace(/[^0-9]/g, ''), 10)
    } else {
      return Number.parseInt(parts[0].replace(/[^0-9]/g, ''), 10)
    }
  } else {
    return Number.parseInt(line.split(' ')[1].split('.')[0], 10)
  }
}

describe('Launcher', () => {
  let javaPath: string
  let javaVersion: number

  // jest.setTimeout(10000000);

  if (process.env.JAVA_HOME) {
    javaPath = `${process.env.JAVA_HOME}/bin/java`
    try {
      javaVersion = getJavaVersion(javaPath)
    } catch {
      javaPath = ''
    }
  } else {
    javaPath = 'java'
    try {
      javaVersion = getJavaVersion(javaPath)
    } catch {
      javaPath = ''
    }
  }

  describe('#generateArgumentsServer', () => {
    test('should generate command arguments', async ({ mock }) => {
      const args = generateArgumentsServer({
        javaPath: '/test/java',
        extraExecOption: {
          cwd: mock,
        },
        // version: '1.7.10',
      })
      assert(args)
      expect(args[0]).toEqual('/test/java')
    })
  })

  describe('#generateArguments', () => {
    test('should throw error if the version is empty', async () => {
      await expect(generateArguments({} as any)).rejects.toEqual(
        new TypeError('Version cannot be null!'),
      )
    })

    test('should generate correct command for 1.17.1-forge-37.0.97', async ({ mock }) => {
      const jPath = '/test/java'
      const version = '1.17.1-forge-37.0.97'

      const gamePath = mock
      const args = await generateArguments({
        version,
        gamePath,
        javaPath: jPath,
        userType: 'mojang',
        accessToken: 'accessToken',
        gameProfile: {
          id: 'profileId',
          name: 'username',
        },
        launcherBrand: 'launcherVersion',
        launcherName: 'launcherName',
      })

      expect(args.indexOf('cpw.mods.bootstraplauncher.BootstrapLauncher')).not.toEqual(-1)
      expect(args[args.indexOf('--username') + 1]).toEqual('username')
      expect(args[args.indexOf('--uuid') + 1]).toEqual('profileId')
      expect(args[args.indexOf('--version') + 1]).toEqual(version)
      expect(args[args.indexOf('--gameDir') + 1]).toEqual(normalize(path.resolve(gamePath)))
      expect(args[args.indexOf('--assetsDir') + 1]).toEqual(normalize(path.resolve(gamePath, 'assets')))
      expect(args.indexOf('java.base/sun.security.util=cpw.mods.securejarhandler')).not.toEqual(-1)
      expect(args.indexOf(`-DlibraryDirectory=${normalize(path.resolve(gamePath, 'libraries'))}`)).not.toEqual(
        -1,
      )
    })

    test('should generate correct command for 1.7.10 with forge', async ({ mock }) => {
      const jPath = '/test/java'
      const version = '1.7.10-Forge10.13.3.1400-1.7.10'

      const gamePath = mock
      const args = await generateArguments({
        version,
        gamePath,
        javaPath: jPath,
        userType: 'mojang',
        accessToken: 'accessToken',
        gameProfile: {
          id: 'profileId',
          name: 'username',
        },
        launcherBrand: 'launcherVersion',
        launcherName: 'launcherName',
      })
      expect(args[0]).toEqual(jPath)
      expect(args.indexOf('net.minecraft.launchwrapper.Launch')).not.toEqual(-1)
      expect(args[args.indexOf('--username') + 1]).toEqual('username')
      expect(args[args.indexOf('--uuid') + 1]).toEqual('profileId')
      expect(args[args.indexOf('--version') + 1]).toEqual('1.7.10-Forge10.13.3.1400-1.7.10')
      expect(args[args.indexOf('--gameDir') + 1]).toEqual(normalize(path.resolve(gamePath)))
      expect(args[args.indexOf('--assetsDir') + 1]).toEqual(normalize(path.resolve(gamePath, 'assets')))
      const lversion = args.find((a) => a.startsWith('-Dminecraft.launcher.version'))
      expect(lversion).toEqual('-Dminecraft.launcher.version=launcherVersion')
      const lname = args.find((a) => a.startsWith('-Dminecraft.launcher.brand'))
      expect(lname).toEqual('-Dminecraft.launcher.brand=launcherName')
    })

    test('should generate correct command for 1.14.4 with forge', async ({ mock }) => {
      const jPath = '/test/java'
      const version = '1.14.4-forge-28.0.47'
      const gamePath = mock
      const args = await generateArguments({
        version,
        gamePath,
        javaPath: jPath,
        launcherBrand: 'launcherVersion',
        launcherName: 'launcherName',
        gameProfile: {
          id: 'userid',
          name: 'username',
        },
      })
      expect(args[0]).toEqual(jPath)
      expect(args.indexOf('cpw.mods.modlauncher.Launcher')).not.toEqual(-1)
      expect(args[args.indexOf('--username') + 1]).toEqual('username')
      expect(args[args.indexOf('--uuid') + 1]).toEqual('userid')
      expect(args[args.indexOf('--version') + 1]).toEqual('1.14.4-forge-28.0.47')
      expect(args[args.indexOf('--gameDir') + 1]).toEqual(normalize(path.resolve(gamePath)))
      expect(args[args.indexOf('--assetsDir') + 1]).toEqual(normalize(path.resolve(gamePath, 'assets')))
      const lversion = args.find((a) => a.startsWith('-Dminecraft.launcher.version'))
      expect(lversion).toEqual('-Dminecraft.launcher.version=launcherVersion')
      const lname = args.find((a) => a.startsWith('-Dminecraft.launcher.brand'))
      expect(lname).toEqual('-Dminecraft.launcher.brand=launcherName')
    })

    test('should generate correct command', async ({ mock }) => {
      const jPath = '/test/java'
      const version = '1.14.4'
      const gamePath = mock
      const args = await generateArguments({
        version,
        gamePath,
        javaPath: jPath,
        gameProfile: {
          id: 'id',
          name: 'name',
        },
        launcherBrand: 'launcherVersion',
        launcherName: 'launcherName',
        server: { ip: 'localhost', port: 10 },
        minMemory: 10,
        maxMemory: 20,
        ignoreInvalidMinecraftCertificates: true,
        ignorePatchDiscrepancies: true,
        extraJVMArgs: ['hello'],
        extraMCArgs: ['Minecraft!'],
      })
      expect(args[0]).toEqual(jPath)
      expect(args.indexOf('net.minecraft.client.main.Main')).not.toEqual(-1)
      expect(args[args.indexOf('--username') + 1]).toEqual('name')
      expect(args[args.indexOf('--uuid') + 1]).toEqual('id')
      expect(args[args.indexOf('--version') + 1]).toEqual(version)
      expect(args[args.indexOf('--gameDir') + 1]).toEqual(normalize(path.resolve(gamePath)))
      expect(args[args.indexOf('--assetsDir') + 1]).toEqual(normalize(path.resolve(gamePath, 'assets')))
      expect(args.indexOf('-Xms10M') !== -1).toBeTruthy()
      expect(args.indexOf('-Xmx20M') !== -1).toBeTruthy()
      expect(args.indexOf('-Dfml.ignoreInvalidMinecraftCertificates=true') !== -1).toBeTruthy()
      expect(args.indexOf('-Dfml.ignorePatchDiscrepancies=true') !== -1).toBeTruthy()
      expect(args.indexOf('hello') + 1).toEqual(args.indexOf('net.minecraft.client.main.Main'))
      expect(args.indexOf('Minecraft!')).toBeGreaterThan(
        args.indexOf('net.minecraft.client.main.Main'),
      )
      expect(args[args.indexOf('--server') + 1]).toEqual('localhost')
      expect(args[args.indexOf('--port') + 1]).toEqual('10')

      expect(args.find((a) => a.startsWith('-Dminecraft.launcher.version'))).toEqual(
        '-Dminecraft.launcher.version=launcherVersion',
      )
      expect(args.find((a) => a.startsWith('-Dminecraft.launcher.brand'))).toEqual(
        '-Dminecraft.launcher.brand=launcherName',
      )
    })
    test('should use default jvm arguments', async ({ mock }) => {
      const jPath = '/test/java'
      const version = '1.14.4'
      const gamePath = mock
      const args = await generateArguments({
        version,
        gamePath,
        javaPath: jPath,
        gameProfile: {
          id: 'id',
          name: 'name',
        },
        launcherBrand: 'launcherVersion',
        launcherName: 'launcherName',
        server: { ip: 'localhost', port: 10 },
        minMemory: 10,
        maxMemory: 20,
        ignoreInvalidMinecraftCertificates: true,
        ignorePatchDiscrepancies: true,
        extraJVMArgs: ['hello'],
        extraMCArgs: ['Minecraft!'],
      })
      expect(DEFAULT_EXTRA_JVM_ARGS.every((a) => args.indexOf(a) !== -1))
    })
    test('should genearte correct command for partial resolution', async ({ mock }) => {
      let args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        resolution: {
          height: 10,
        },
      })
      expect(args.indexOf('net.minecraft.client.main.Main')).not.toBe(-1)
      expect(args[args.indexOf('--height') + 1]).toEqual('10')

      args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        resolution: {
          width: 10,
        },
      })
      expect(args.indexOf('net.minecraft.client.main.Main')).not.toBe(-1)
      expect(args[args.indexOf('--width') + 1]).toEqual('10')
    })
    test('should genearte correct command for fullscreen', async ({ mock }) => {
      const args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        resolution: {
          fullscreen: true,
        },
      })
      expect(args.indexOf('net.minecraft.client.main.Main')).not.toBe(-1)
      expect(args.indexOf('--fullscreen'))
    })
    test('should generate default user', async ({ mock }) => {
      const args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
      })
      expect(args.indexOf('net.minecraft.client.main.Main')).not.toBe(-1)
      expect(args[args.indexOf('--username') + 1]).toEqual('Steve')
      // expect(args[args.indexOf("--uuid") + 1]);
    })
    test('should generate correct command with server', async ({ mock }) => {
      const server = {
        ip: '127.0.0.1',
      }
      const args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        server,
      })
      expect(args[args.indexOf('--server') + 1]).toEqual(server.ip)
    })
    test('should generate correct command with server with port', async ({ mock }) => {
      const server = {
        ip: '127.0.0.1',
        port: 25565,
      }
      const args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        server,
      })
      expect(args[args.indexOf('--server') + 1]).toEqual(server.ip)
      expect(args[args.indexOf('--port') + 1]).toEqual(server.port.toString())
    })
    test('should generate correct command with quickPlayMultiplayer', async ({ mock }) => {
      const args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        quickPlayMultiplayer: '127.0.0.1:25565',
      })
      expect(args[args.indexOf('--quickPlayMultiplayer') + 1]).toEqual('127.0.0.1:25565')
      // Should not contain old server arguments
      expect(args.indexOf('--server')).toBe(-1)
      expect(args.indexOf('--port')).toBe(-1)
    })
    test('should allow both quickPlayMultiplayer and server options for compatibility', async ({
      mock,
    }) => {
      const server = {
        ip: '192.168.1.1',
        port: 25565,
      }
      const args = await generateArguments({
        version: '1.14.4',
        gamePath: mock,
        javaPath: '/test/java',
        server,
        quickPlayMultiplayer: '127.0.0.1:25565',
      })
      expect(args[args.indexOf('--quickPlayMultiplayer') + 1]).toEqual('127.0.0.1:25565')
      // Should also contain legacy server arguments for compatibility
      expect(args[args.indexOf('--server') + 1]).toEqual('192.168.1.1')
      expect(args[args.indexOf('--port') + 1]).toEqual('25565')
    })
  })

  describe('#createQuickPlayMultiplayer', () => {
    test('should create quickPlayMultiplayer string with IP only', () => {
      const result = createQuickPlayMultiplayer('127.0.0.1')
      expect(result).toEqual('127.0.0.1')
    })

    test('should create quickPlayMultiplayer string with IP and port', () => {
      const result = createQuickPlayMultiplayer('127.0.0.1', 25565)
      expect(result).toEqual('127.0.0.1:25565')
    })

    test('should create quickPlayMultiplayer string with custom port', () => {
      const result = createQuickPlayMultiplayer('play.example.com', 8080)
      expect(result).toEqual('play.example.com:8080')
    })
  })
})
