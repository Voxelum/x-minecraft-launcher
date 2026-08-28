import type { ResourceMetadata } from '@xmcl/resource'
import { ensureDir, mkdtemp, pathExists, rm, symlink, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { getModIds, getRemovableConfigPaths, removeMappedConfigFile } from './modConfig'

describe('mod config cleanup', () => {
  let instancePath: string

  beforeEach(async () => {
    instancePath = await mkdtemp(join(tmpdir(), 'xmcl-mod-config-'))
    await ensureDir(join(instancePath, 'config'))
  })

  afterEach(async () => {
    await rm(instancePath, { recursive: true, force: true })
  })

  test('collects mod ids from supported metadata', () => {
    const metadata = {
      forge: { modid: 'forge-mod', modsToml: [{ modid: 'forge-child' }] },
      fabric: [{ id: 'fabric-mod' }],
      quilt: { quilt_loader: { id: 'quilt-mod' } },
      neoforge: { modid: 'neo-mod', children: [{ modid: 'neo-child' }] },
    } as ResourceMetadata

    expect(getModIds(metadata)).toEqual([
      'forge-mod',
      'forge-child',
      'neo-mod',
      'neo-child',
      'fabric-mod',
      'quilt-mod',
    ])
  })

  test('keeps config paths still claimed by an installed mod', () => {
    const mappings = {
      removed: ['removed.toml', 'shared.toml'],
      installed: ['shared.toml'],
    }

    expect(getRemovableConfigPaths(mappings, ['removed'], ['installed'])).toEqual(['removed.toml'])
  })

  test('removes only files contained by the config directory', async () => {
    const configFile = join(instancePath, 'config', 'nested', 'removed.toml')
    const outsideFile = join(instancePath, 'outside.toml')
    await ensureDir(join(instancePath, 'config', 'nested'))
    await writeFile(configFile, 'config')
    await writeFile(outsideFile, 'outside')

    await expect(removeMappedConfigFile(instancePath, 'nested/removed.toml')).resolves.toBe(true)
    await expect(removeMappedConfigFile(instancePath, '../outside.toml')).resolves.toBe(false)
    expect(await pathExists(configFile)).toBe(false)
    expect(await pathExists(outsideFile)).toBe(true)
  })

  test.runIf(process.platform !== 'win32')('does not follow a parent symlink outside config', async () => {
    const outsideDirectory = join(instancePath, 'outside')
    const outsideFile = join(outsideDirectory, 'keep.toml')
    await ensureDir(outsideDirectory)
    await writeFile(outsideFile, 'outside')
    await symlink(outsideDirectory, join(instancePath, 'config', 'linked'))

    await expect(removeMappedConfigFile(instancePath, 'linked/keep.toml')).resolves.toBe(false)
    expect(await pathExists(outsideFile)).toBe(true)
  })
})
