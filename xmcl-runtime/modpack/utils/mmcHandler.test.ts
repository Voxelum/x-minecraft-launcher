import { open, readAllEntries } from '@xmcl/unzip'
import type { Entry, ZipFile } from '@xmcl/yauzl'
import { describe, expect, it } from 'vitest'
import { ZipFile as YazlZipFile } from 'yazl'
import { createMmcHandler } from './mmcHandler'

function buildZip(files: Record<string, string>): Promise<Buffer> {
  const zip = new YazlZipFile()
  for (const [path, content] of Object.entries(files)) {
    zip.addBuffer(Buffer.from(content), path)
  }
  zip.end()
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    zip.outputStream.on('data', (c: Buffer) => chunks.push(c))
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
  })
}

async function openZip(files: Record<string, string>): Promise<{ zip: ZipFile; entries: Entry[] }> {
  const buf = await buildZip(files)
  const zip = await open(buf)
  const entries = await readAllEntries(zip)
  return { zip, entries }
}

const handler = createMmcHandler({} as any)

const MMC_PACK = JSON.stringify({
  formatVersion: 1,
  components: [
    { uid: 'net.minecraft', version: '1.7.10' },
    { uid: 'me.eigenraven.lwjgl3ify.forgepatches', version: '2.1.16' },
    { uid: 'net.minecraftforge', version: '10.13.4.1614' },
  ],
})

const INSTANCE_CFG = 'name=GTNH\nnotes=\nJvmArgs=-Xmx8G\n'

const PATCH_LWJGL = JSON.stringify({
  formatVersion: 1,
  name: 'LWJGL3ify Early Classpath',
  uid: 'me.eigenraven.lwjgl3ify.forgepatches',
  version: '2.1.16',
  '+jvmArgs': [
    '-Dfile.encoding=UTF-8',
    '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
  ],
})

const PATCH_FORGE = JSON.stringify({
  formatVersion: 1,
  uid: 'net.minecraftforge',
  version: '10.13.4.1614',
  '+tweakers': ['cpw.mods.fml.common.launcher.FMLTweaker'],
})

describe('createMmcHandler', () => {
  describe('readManifest', () => {
    it('reads a flat MultiMC export (mmc-pack.json at zip root)', async () => {
      const { zip, entries } = await openZip({
        'mmc-pack.json': MMC_PACK,
        'instance.cfg': INSTANCE_CFG,
      })

      const manifest = await handler.readManifest(zip, entries)

      expect(manifest).toBeDefined()
      expect(manifest!.prefix).toBeUndefined()
      expect(manifest!.cfg.name).toBe('GTNH')
      expect(manifest!.cfg.JvmArgs).toBe('-Xmx8G')
      expect(manifest!.patches).toBeUndefined()
    })

    it('detects a single nested root folder used by Prism Launcher exports', async () => {
      const { zip, entries } = await openZip({
        'GT New Horizons 2.8.4/mmc-pack.json': MMC_PACK,
        'GT New Horizons 2.8.4/instance.cfg': INSTANCE_CFG,
      })

      const manifest = await handler.readManifest(zip, entries)

      expect(manifest).toBeDefined()
      expect(manifest!.prefix).toBe('GT New Horizons 2.8.4/')
      expect(manifest!.cfg.name).toBe('GTNH')
    })

    it('loads `patches/*.json` and keys the map by component uid', async () => {
      const { zip, entries } = await openZip({
        'GT New Horizons 2.8.4/mmc-pack.json': MMC_PACK,
        'GT New Horizons 2.8.4/instance.cfg': INSTANCE_CFG,
        'GT New Horizons 2.8.4/patches/me.eigenraven.lwjgl3ify.forgepatches.json': PATCH_LWJGL,
        'GT New Horizons 2.8.4/patches/net.minecraftforge.json': PATCH_FORGE,
      })

      const manifest = await handler.readManifest(zip, entries)

      expect(manifest?.patches).toBeDefined()
      const p = manifest!.patches!
      expect(Object.keys(p).sort()).toEqual([
        'me.eigenraven.lwjgl3ify.forgepatches',
        'net.minecraftforge',
      ])
      expect(p['me.eigenraven.lwjgl3ify.forgepatches']['+jvmArgs']).toContain('-Dfile.encoding=UTF-8')
      expect(p['net.minecraftforge']['+tweakers']).toEqual([
        'cpw.mods.fml.common.launcher.FMLTweaker',
      ])
    })

    it('survives an unparseable patch file by skipping just that file', async () => {
      const { zip, entries } = await openZip({
        'mmc-pack.json': MMC_PACK,
        'instance.cfg': INSTANCE_CFG,
        'patches/net.minecraftforge.json': PATCH_FORGE,
        'patches/broken.json': '{ this is not json',
      })

      const manifest = await handler.readManifest(zip, entries)

      expect(manifest?.patches).toBeDefined()
      expect(Object.keys(manifest!.patches!)).toEqual(['net.minecraftforge'])
    })

    it('returns undefined when no mmc-pack.json is present', async () => {
      const { zip, entries } = await openZip({
        'manifest.json': '{}',
        '.minecraft/mods/foo.jar': 'x',
      })

      const manifest = await handler.readManifest(zip, entries)

      expect(manifest).toBeUndefined()
    })
  })

  describe('resolveUnpackPath', () => {
    const mkEntry = (fileName: string): Entry => ({ fileName } as Entry)

    it('strips `.minecraft/` for classic MultiMC layouts', () => {
      const result = handler.resolveUnpackPath({ prefix: undefined } as any, mkEntry('.minecraft/mods/foo.jar'))
      expect(result).toBe('mods/foo.jar')
    })

    it('strips `minecraft/` for Prism Launcher layouts', () => {
      const result = handler.resolveUnpackPath({ prefix: undefined } as any, mkEntry('minecraft/mods/foo.jar'))
      expect(result).toBe('mods/foo.jar')
    })

    it('strips the nested root prefix before the game-dir prefix', () => {
      const m = { prefix: 'GT New Horizons 2.8.4/' } as any
      expect(handler.resolveUnpackPath(m, mkEntry('GT New Horizons 2.8.4/.minecraft/mods/foo.jar')))
        .toBe('mods/foo.jar')
      expect(handler.resolveUnpackPath(m, mkEntry('GT New Horizons 2.8.4/minecraft/mods/bar.jar')))
        .toBe('mods/bar.jar')
    })

    it('ignores entries outside the detected prefix', () => {
      const m = { prefix: 'pack/' } as any
      expect(handler.resolveUnpackPath(m, mkEntry('other/.minecraft/foo.jar'))).toBeUndefined()
    })

    it('returns undefined for files outside any minecraft game directory', () => {
      // mmc-pack.json itself, instance.cfg, patches/*.json must not be unpacked.
      const m = { prefix: 'pack/' } as any
      expect(handler.resolveUnpackPath(m, mkEntry('pack/mmc-pack.json'))).toBeUndefined()
      expect(handler.resolveUnpackPath(m, mkEntry('pack/instance.cfg'))).toBeUndefined()
      expect(handler.resolveUnpackPath(m, mkEntry('pack/patches/net.minecraft.json'))).toBeUndefined()
    })
  })
})
