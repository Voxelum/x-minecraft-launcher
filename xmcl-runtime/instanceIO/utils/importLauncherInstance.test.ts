import { type CreateInstanceOptions, type MMCModpackManifest, parseLauncherData } from '@xmcl/instance'
import { randomUUID } from 'crypto'
import { mkdir, readFile, rm } from 'fs/promises'
import { outputFile, outputJson, pathExists, readJson } from 'fs-extra'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { persistMmcStandaloneVersion } from '../../util/mmcStandaloneVersion'
import { importLauncherInstance } from './importLauncherInstance'

describe('launcher directory persistence', () => {
  let root: string
  let gameDirectory: string
  let destination: string
  let manifest: MMCModpackManifest
  const createInstance = vi.fn<(options: CreateInstanceOptions) => Promise<string>>()
  const refreshVersion = vi.fn<(id: string) => Promise<void>>()

  beforeEach(async () => {
    root = join(process.cwd(), `.test-mmc-persistence-${randomUUID()}`)
    gameDirectory = join(root, 'xmcl')
    destination = join(root, 'imported')
    await mkdir(root)
    createInstance.mockReset().mockImplementation(async (options) => {
      await outputJson(join(destination, 'instance.json'), options)
      return destination
    })
    refreshVersion.mockReset().mockResolvedValue()
    manifest = {
      cfg: { name: 'GTNH', notes: '' },
      json: {
        formatVersion: 1,
        components: [{ uid: 'net.minecraft', version: '1.7.10' }, { uid: 'net.minecraftforge', version: '10.13.4.1614' }],
      },
      patches: {
        'net.minecraft': {
          uid: 'net.minecraft', order: -2, mainClass: 'net.minecraft.client.main.Main',
          minecraftArguments: '--username ${auth_player_name}',
          compatibleJavaMajors: [17, 21, 25],
          mainJar: { name: 'com.mojang:minecraft:1.7.10', downloads: { artifact: { url: 'https://example.com/client.jar', sha1: 'client', size: 10 } } },
          libraries: [{ name: 'org.lwjgl:lwjgl:2.9.4' }],
        },
        'net.minecraftforge': {
          uid: 'net.minecraftforge', mainClass: 'com.gtnewhorizons.retrofuturabootstrap.Main',
          '+jvmArgs': ['--add-opens=java.base/java.lang=ALL-UNNAMED'],
          '+tweakers': ['cpw.mods.fml.common.launcher.FMLTweaker'],
          libraries: [{ name: 'com.gtnewhorizons:retrofuturabootstrap:1.0', 'MMC-hint': 'local' }],
        },
      },
    }
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function writeInstance(folder: string, mavenLayout = false) {
    const source = join(root, 'prism', 'instances', 'GTNH')
    await outputJson(join(source, 'mmc-pack.json'), manifest.json)
    await outputFile(join(source, 'instance.cfg'), 'name=GTNH\nJvmArgs=-Dlegacy=true')
    for (const [uid, patch] of Object.entries(manifest.patches || {})) {
      await outputJson(join(source, 'patches', `${uid}.json`), patch)
    }
    await outputFile(join(source, folder, 'mods', 'gregtech.jar'), 'mod')
    await outputFile(join(source, folder, 'config', 'libraries', 'settings.cfg'), 'keep nested folders')
    await outputFile(join(source, folder, 'libraries', 'ignored.jar'), 'not a game file')
    const library = mavenLayout
      ? join('com', 'gtnewhorizons', 'retrofuturabootstrap', '1.0', 'retrofuturabootstrap-1.0.jar')
      : 'retrofuturabootstrap-1.0.jar'
    await outputFile(join(source, 'libraries', library), 'bootstrap')
    return source
  }

  it.each([['minecraft', false], ['.minecraft', true]] as const)(
    'imports %s with patch options, local jars and a registered pinned version',
    async (folder, mavenLayout) => {
      const source = await writeInstance(folder, mavenLayout)
      const preview = await parseLauncherData(source, 'mmc')
      // A version from source metadata/preview must never become an output path.
      preview.instances[0].options.version = '../../untrusted'
      await importLauncherInstance(preview.instances[0], gameDirectory, createInstance, refreshVersion)

      const options = await readJson(join(destination, 'instance.json'))
      expect(options.version).toMatch(/^mmc-GTNH-[a-f0-9]{16}$/)
      expect(options.runtime).toMatchObject({ minecraft: '1.7.10', forge: '10.13.4.1614' })
      expect(options.vmOptions).toEqual(['-Dlegacy=true', '--add-opens=java.base/java.lang=ALL-UNNAMED'])
      expect(options.mcOptions).toEqual(['--tweakClass', 'cpw.mods.fml.common.launcher.FMLTweaker'])
      expect(refreshVersion).toHaveBeenCalledWith(options.version)
      const version = await readJson(join(gameDirectory, 'versions', options.version, `${options.version}.json`))
      expect(version).toMatchObject({
        mainClass: 'com.gtnewhorizons.retrofuturabootstrap.Main', clientVersion: '1.7.10',
        compatibleJavaMajors: [17, 21, 25], javaVersion: { majorVersion: 17 },
        downloads: { client: { url: 'https://example.com/client.jar' } },
      })
      expect(await readFile(join(gameDirectory, 'libraries', 'com', 'gtnewhorizons', 'retrofuturabootstrap', '1.0', 'retrofuturabootstrap-1.0.jar'), 'utf8')).toBe('bootstrap')
      expect(await readFile(join(destination, 'mods', 'gregtech.jar'), 'utf8')).toBe('mod')
      expect(await readFile(join(destination, 'config', 'libraries', 'settings.cfg'), 'utf8')).toBe('keep nested folders')
      for (const excluded of ['minecraft', '.minecraft', 'patches', 'instance.cfg', 'mmc-pack.json', 'libraries']) {
        expect(await pathExists(join(destination, excluded))).toBe(false)
      }
      expect(await readFile(join(source, folder, 'mods', 'gregtech.jar'), 'utf8')).toBe('mod')
    },
  )

  it('keeps ordinary MultiMC instances on runtime installation without a standalone version', async () => {
    manifest.patches = undefined
    const source = await writeInstance('minecraft')
    const preview = await parseLauncherData(source, 'mmc')
    await importLauncherInstance(preview.instances[0], gameDirectory, createInstance, refreshVersion)
    expect(createInstance.mock.calls[0][0].version).toBe('')
    expect(refreshVersion).not.toHaveBeenCalled()
    expect(await pathExists(join(destination, 'mods', 'gregtech.jar'))).toBe(true)
  })

  it('does not create a silently broken instance when a local jar is missing', async () => {
    const source = await writeInstance('minecraft')
    await rm(join(source, 'libraries'), { recursive: true })
    const preview = await parseLauncherData(source, 'mmc')
    await expect(importLauncherInstance(preview.instances[0], gameDirectory, createInstance, refreshVersion))
      .rejects.toThrow('Cannot find local library')
    expect(createInstance).not.toHaveBeenCalled()
    expect(refreshVersion).not.toHaveBeenCalled()
    expect(await pathExists(join(gameDirectory, 'versions'))).toBe(false)
  })

  it('propagates version-registration, creation and copy errors', async () => {
    const source = await writeInstance('minecraft')
    const [instance] = (await parseLauncherData(source, 'mmc')).instances
    refreshVersion.mockRejectedValueOnce(new Error('registration failed'))
    await expect(importLauncherInstance(instance, gameDirectory, createInstance, refreshVersion)).rejects.toThrow('registration failed')
    expect(createInstance).not.toHaveBeenCalled()
    createInstance.mockRejectedValueOnce(new Error('creation failed'))
    await expect(importLauncherInstance(instance, gameDirectory, createInstance, refreshVersion)).rejects.toThrow('creation failed')
    createInstance.mockImplementationOnce(async () => {
      await outputFile(destination, 'not a directory')
      return destination
    })
    await expect(importLauncherInstance(instance, gameDirectory, createInstance, refreshVersion)).rejects.toThrow()
  })

  it.each(['vanilla', 'curseforge', 'modrinth'])('preserves a %s game root and options', async (launcher) => {
    const source = join(root, launcher)
    await outputFile(join(source, 'mods', 'mod.jar'), 'mod')
    await outputFile(join(source, 'libraries', 'shared.jar'), 'shared')
    const options: CreateInstanceOptions = { name: launcher, runtime: { minecraft: '1.21' }, version: 'existing-custom-version' }
    await importLauncherInstance({ path: source, options }, gameDirectory, createInstance, refreshVersion)
    expect(createInstance).toHaveBeenCalledWith(options)
    expect(await readFile(join(destination, 'mods', 'mod.jar'), 'utf8')).toBe('mod')
    expect(await pathExists(join(destination, 'libraries'))).toBe(false)
    expect(refreshVersion).not.toHaveBeenCalled()
  })

  it('uses stable isolated IDs rather than overwriting same-named vanilla or changed packs', async () => {
    const persist = () => persistMmcStandaloneVersion({
      manifest, name: '1.7.10', gameDirectory, refreshVersion,
      readLocalLibrary: async () => Buffer.from('bootstrap'),
    })
    await outputJson(join(gameDirectory, 'versions', '1.7.10', '1.7.10.json'), { id: 'vanilla' })
    const first = await persist()
    expect(await persist()).toBe(first)
    manifest.patches!['net.minecraftforge'].mainClass = 'another.Main'
    expect(await persist()).not.toBe(first)
    expect(await readJson(join(gameDirectory, 'versions', '1.7.10', '1.7.10.json'))).toEqual({ id: 'vanilla' })
  })

  it('rejects unsafe local Maven coordinates before reading or writing any library', async () => {
    manifest.patches!['net.minecraftforge'].libraries![0].name = 'group:../../outside:1'
    const readLocalLibrary = vi.fn(async () => Buffer.from('bad'))
    await expect(persistMmcStandaloneVersion({
      manifest, name: '../unsafe', gameDirectory, refreshVersion, readLocalLibrary,
    })).rejects.toThrow('Invalid MultiMC local library path')
    expect(readLocalLibrary).not.toHaveBeenCalled()
  })
})
