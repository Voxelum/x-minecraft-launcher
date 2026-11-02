import { describe, expect, it } from 'vitest'
import type { CachedFTBModpackVersionManifest, FTBFile, JavaRecord } from '@xmcl/runtime-api'
import skyOdyssey from './__fixtures__/ftb-sky-odyssey.json'
import { getFTBPath, getFTBTemplateAndFile } from './ftb'

// Reduced from https://api.modpacks.ch/public/modpack/8/12268 (2026-11-02).
const manifest = skyOdyssey as unknown as CachedFTBModpackVersionManifest
const java = (version: string, majorVersion: number, path = version) => ({ version, majorVersion, path }) as JavaRecord

describe('FTB client manifest conversion', () => {
  it.each([
    ['./config', 'test.cfg', 'config/test.cfg'],
    ['./config/', 'test.cfg', 'config/test.cfg'],
    ['./mods', '/test.jar', 'mods/test.jar'],
    ['', 'README.md', 'README.md'],
    ['./', 'README.md', 'README.md'],
  ])('joins directory %s and name %s', (path, name, expected) => {
    expect(getFTBPath({ path, name } as FTBFile)).toBe(expected)
  })

  it('preserves actual Sky Odyssey client paths and excludes server-only files', () => {
    const [config, files] = getFTBTemplateAndFile(manifest, [java('1.8.0_302', 8)])
    expect(config.runtime.minecraft).toBe('1.12.2')
    expect(config.runtime.forge).toBe('14.23.5.2857')
    expect(config.java).toBe('1.8.0_302')
    expect(files).toHaveLength(2)
    expect(files[0].path).toBe(`mods/${manifest.files[0].name}`)
    expect(files[1]).toMatchObject({
      path: 'config/teamislands.cfg',
      hashes: { sha1: 'afa4f8f3af20a4f9252440c0ed9c8957e730ece7' },
      downloads: [manifest.files[1].url],
      size: 2247,
    })
    expect(files.some(f => f.path === 'SERVER_OWNER_README.md')).toBe(false)
  })

  it.each([
    ['1.8.0', [java('1.8.0', 8)], '1.8.0'],
    ['1.8.0_302', [java('1.8.0_301', 8), java('1.8.0_302', 8)], '1.8.0_302'],
    ['1.17.0', [java('17.0.0', 17), java('17.0.1', 17)], '17.0.0'],
    ['17.0.0', [java('17.0.1', 17), java('17.0.0', 17)], '17.0.0'],
    ['21.0.2', [java('17.0.2', 17)], ''],
  ])('handles Java target %s independently of file conversion', (version, javas, expected) => {
    const target = { ...manifest, targets: [{ name: 'java', version, type: 'runtime', id: 1, updated: 0 }] }
    expect(getFTBTemplateAndFile(target, javas)[0].java).toBe(expected)
  })
})
