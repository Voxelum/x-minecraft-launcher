import { randomUUID } from 'crypto'
import { mkdir, readFile, rename, rm } from 'fs/promises'
import { outputFile, outputJson } from 'fs-extra'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectLauncherType, parseInstanceFiles, parseLauncherData } from '../launcher_parser'
import { parseMultiMCInstance, readMultiMCManifest } from './multimc_parser'

describe('MultiMC directory import discovery', () => {
  let root: string

  beforeEach(async () => {
    root = join(process.cwd(), `.test-mmc-directory-${randomUUID()}`)
    await mkdir(root)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function instance(name = 'GTNH', folder = 'minecraft') {
    const path = join(root, 'instances', name)
    await outputFile(join(path, 'instance.cfg'), [
      '[General]', `name=${name}`, 'notes=GregTech', 'JvmArgs=-Dconfig=true',
      'MinMemAlloc=4096', 'MaxMemAlloc=8192', 'JavaPath=java',
      'OverrideCommands=true', 'WrapperCommand=env FOO=bar wrapper',
    ].join('\n'))
    await outputJson(join(path, 'mmc-pack.json'), {
      formatVersion: 1,
      components: [{ uid: 'net.minecraft', version: '1.7.10' }, { uid: 'net.minecraftforge', version: '10.13.4.1614' }],
    })
    await outputJson(join(path, 'patches', 'forge.json'), {
      uid: 'net.minecraftforge',
      mainClass: 'com.gtnewhorizons.retrofuturabootstrap.Main',
      '+jvmArgs': ['--add-opens=java.base/java.lang=ALL-UNNAMED'],
      '+tweakers': ['cpw.mods.fml.common.launcher.FMLTweaker'],
    })
    await outputFile(join(path, folder, 'mods', 'gregtech.jar'), 'mod')
    await outputFile(join(path, folder, 'libraries', 'cached.jar'), 'cache')
    await outputFile(join(path, 'libraries', 'rfb.jar'), 'library')
    return path
  }

  it('previews patch arguments and directory-only settings through the shared config merger', async () => {
    const path = await instance()
    const manifest = await readMultiMCManifest(path)
    expect(manifest.patches?.['net.minecraftforge'].mainClass).toContain('retrofuturabootstrap')
    const options = await parseMultiMCInstance(path)
    expect(options).toMatchObject({
      name: 'GTNH', java: 'java', minMemory: 4096, maxMemory: 8192,
      runtime: { minecraft: '1.7.10', forge: '10.13.4.1614' },
      vmOptions: ['-Dconfig=true', '--add-opens=java.base/java.lang=ALL-UNNAMED'],
      mcOptions: ['--tweakClass', 'cpw.mods.fml.common.launcher.FMLTweaker'],
      prependCommand: 'env FOO=bar wrapper',
    })
  })

  it.each(['minecraft', '.minecraft'])('lists %s files relative to the game root with usable local URLs', async (folder) => {
    const path = await instance('GTNH', folder)
    for (const selected of [path, join(path, folder)]) {
      const files = await parseInstanceFiles(selected)
      expect(files).toHaveLength(1)
      expect(files[0]).toMatchObject({
        path: 'mods/gregtech.jar',
        downloads: [pathToFileURL(join(path, folder, 'mods', 'gregtech.jar')).toString()],
      })
      expect(await readFile(new URL(files[0].downloads![0]), 'utf8')).toBe('mod')
    }
  })

  it('supports a root, instances directory, selected instance and detached instance', async () => {
    const path = await instance()
    await instance('Other')
    await outputFile(join(root, 'instances', 'instgroups.json'), '{}')
    for (const selected of [root, join(root, 'instances')]) {
      expect(detectLauncherType(selected)).toBe('mmc')
      const parsed = await parseLauncherData(selected)
      expect(parsed.instances).toHaveLength(2)
      expect(parsed.folder).toEqual({ assets: '', libraries: '', versions: '', jre: undefined })
    }
    for (const selected of [path, join(path, 'minecraft')]) {
      const parsed = await parseLauncherData(selected)
      expect(parsed.instances).toHaveLength(1)
      expect(parsed.instances[0].path).toBe(path)
    }
    const detached = join(root, 'detached')
    await rename(path, detached)
    expect((await parseLauncherData(detached, 'mmc')).instances[0].path).toBe(detached)
  })

  it('does not report success after a declared instance patch fails to parse', async () => {
    const path = await instance()
    await outputFile(join(path, 'patches', 'forge.json'), '{bad json')
    await expect(parseLauncherData(root, 'mmc')).rejects.toThrow()
  })

  it('does not silently skip an incomplete instance during migration', async () => {
    const path = await instance()
    await rm(join(path, 'mmc-pack.json'))
    await expect(parseLauncherData(root, 'mmc')).rejects.toThrow('Bad instance path')
  })

  it('continues supporting vanilla, CurseForge and Modrinth launcher discovery', async () => {
    const vanilla = join(root, 'vanilla')
    await outputJson(join(vanilla, 'launcher_profiles.json'), { profiles: { test: { name: 'Vanilla', lastVersionId: '1.21' } } })
    expect((await parseLauncherData(vanilla)).instances[0].options.runtime?.minecraft).toBe('1.21')
    const curseforge = join(root, 'curseforge')
    await outputJson(join(curseforge, 'Instances', 'test', 'minecraftinstance.json'), {
      name: 'CurseForge', lastPlayed: '2026-01-01',
      manifest: { minecraft: { version: '1.20.1', modLoaders: [] } },
    })
    expect((await parseLauncherData(curseforge)).instances[0].options.name).toBe('CurseForge')
    const modrinth = join(root, 'modrinth')
    await outputJson(join(modrinth, 'profiles', 'test', 'profile.json'), {
      metadata: { name: 'Modrinth', game_version: '1.21', loader: 'vanilla' },
    })
    expect((await parseLauncherData(modrinth)).instances[0].options.name).toBe('Modrinth')
  })
})
