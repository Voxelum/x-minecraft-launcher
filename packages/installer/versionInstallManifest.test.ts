import { describe, expect, test, vi } from 'vitest'
import {
  resolveVersionInstallManifest,
  resolveVersionRepairManifest,
} from './versionInstallManifest'

const minecraft = { id: '1.20.1', type: 'release', url: 'https://example.com/1.20.1.json' } as any

function createResolver() {
  return {
    getMinecraftVersion: vi.fn().mockResolvedValue(minecraft),
    findLocalVersion: vi.fn().mockResolvedValue(undefined),
    getForgeVersion: vi.fn().mockResolvedValue({
      version: '47.3.0',
      installer: { path: 'forge-installer.jar', sha1: 'forge-sha1' },
    }),
    getNeoForgedVersion: vi.fn().mockResolvedValue('20.1.1'),
    getLabyModManifest: vi.fn().mockResolvedValue({ version: '4' }),
  }
}

describe('instance version recipe resolver', () => {
  test('resolves a compact serializable layer recipe', async () => {
    const recipe = await resolveVersionInstallManifest(
      { runtime: { minecraft: '1.20.1', forge: '47.3.0' } },
      createResolver(),
    )

    expect(JSON.parse(JSON.stringify(recipe))).toEqual(recipe)
    expect(recipe).toMatchObject({
      schemaVersion: 2,
      kind: 'install',
      minecraft,
      layers: [{
        type: 'forge',
        version: '47.3.0',
        installer: { path: 'forge-installer.jar', sha1: 'forge-sha1' },
      }],
    })
    expect(recipe).not.toHaveProperty('tasks')
  })

  test('keeps ordered layer composition', async () => {
    const recipe = await resolveVersionInstallManifest(
      { runtime: { minecraft: '1.20.1', labyMod: '4', forge: '47.3.0', optifine: 'HD_U_I6' } },
      createResolver(),
    )

    expect(recipe.kind).toBe('install')
    if (recipe.kind === 'install') {
      expect(recipe.layers.map((layer) => layer.type)).toEqual(['labymod', 'forge', 'optifine'])
    }
  })

  test('matches local optifine against the complete runtime', async () => {
    const resolver = createResolver()
    await resolveVersionInstallManifest(
      {
        runtime: {
          minecraft: '1.20.1',
          neoForged: '20.1.1',
          optifine: 'HD_U_I6',
          labyMod: '4',
        },
      },
      resolver,
    )

    expect(resolver.findLocalVersion).toHaveBeenCalledWith({
      minecraft: '1.20.1',
      forge: undefined,
      neoForged: '20.1.1',
      fabricLoader: undefined,
      quiltLoader: undefined,
      optifine: 'HD_U_I6',
      labyMod: '4',
    })
  })

  test('represents repair as data without execution operations', () => {
    const recipe = resolveVersionRepairManifest({
      runtime: { minecraft: '1.20.1' },
      resolvedVersion: 'resolved',
      issue: { assets: [{ name: 'asset', hash: 'hash', size: 1 }] },
    })

    expect(recipe).toMatchObject({
      schemaVersion: 2,
      kind: 'repair',
      version: 'resolved',
      issue: { assets: [{ name: 'asset', hash: 'hash', size: 1 }] },
    })
  })
})