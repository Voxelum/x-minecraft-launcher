import type { InstanceManifest } from '@xmcl/instance'
import { describe, expect, it } from 'vitest'
import { createScopedInstanceManifest, getDefaultInstanceSharingFiles, getInstanceSharingRevisionSource, resolveInstanceSharingPath } from './instanceSharing'

const files = [
  { path: 'mods/enabled.jar', hashes: { sha1: 'enabled' } },
  { path: 'mods/disabled.jar.disabled', hashes: { sha1: 'disabled' } },
  { path: 'config/example.toml', hashes: { sha1: 'config' } },
  { path: 'resourcepacks/example.zip', hashes: { sha1: 'resourcepack' } },
  { path: 'shaderpacks/example.zip', hashes: { sha1: 'shaderpack' } },
  { path: 'options.txt', hashes: { sha1: 'options' } },
  { path: 'saves/world/level.dat', hashes: { sha1: 'save' } },
]

describe('instance sharing scope', () => {
  it('prefers the selected running instance and otherwise uses the first running instance', () => {
    expect(resolveInstanceSharingPath(['instance-a', 'instance-b'], 'instance-b')).toBe('instance-b')
    expect(resolveInstanceSharingPath(['instance-a', 'instance-b'], 'instance-c')).toBe('instance-a')
    expect(resolveInstanceSharingPath([], 'instance-a')).toBe('')
  })

  it('defaults to common modpack files and excludes saves and disabled files', () => {
    expect(getDefaultInstanceSharingFiles(files)).toEqual([
      'mods/enabled.jar',
      'config/example.toml',
      'resourcepacks/example.zip',
      'shaderpacks/example.zip',
      'options.txt',
    ])
  })

  it('filters the manifest and fingerprints only the shared mods', async () => {
    const manifest = {
      runtime: {
        minecraft: '1.21.1',
        forge: '',
        neoForged: '',
        fabricLoader: '',
        quiltLoader: '',
        optifine: '',
        labyMod: '',
      },
      files,
      fingerprint: 'full-instance',
    } as InstanceManifest

    const withMod = await createScopedInstanceManifest(manifest, [
      'mods/enabled.jar',
      'config/example.toml',
    ])
    const withoutMod = await createScopedInstanceManifest(manifest, ['config/example.toml'])

    expect(withMod.files.map((file) => file.path)).toEqual([
      'mods/enabled.jar',
      'config/example.toml',
    ])
    expect(withMod.fingerprint).not.toBe('full-instance')
    expect(withoutMod.fingerprint).not.toBe(withMod.fingerprint)
    expect(getInstanceSharingRevisionSource(withMod)).not.toBe(getInstanceSharingRevisionSource(withoutMod))
  })
})
