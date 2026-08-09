import { describe, expect, test } from 'vitest'
import { getModLoaderIncompatibilities } from './modCompatible'

describe('mod loader compatibility', () => {
  const mods = [
    { modId: 'forge-mod', fileName: 'forge.jar', enabled: true, modLoaders: ['forge'] },
    { modId: 'fabric-mod', fileName: 'fabric.jar', enabled: true, modLoaders: ['fabric'] },
    { modId: 'disabled-mod', fileName: 'disabled.jar', enabled: false, modLoaders: ['quilt'] },
    { modId: 'unknown-mod', fileName: 'unknown.jar', enabled: true, modLoaders: [] },
  ] as any

  test('accepts every loader allowed by the UI runtime context', () => {
    expect(getModLoaderIncompatibilities(mods, ['forge', 'fabric'])).toEqual([])
  })

  test('reports enabled mods that do not support the allowed loader', () => {
    expect(getModLoaderIncompatibilities(mods, ['neoforge'])).toEqual([
      { mod: 'forge-mod', file: 'forge.jar', supportedLoaders: ['forge'] },
      { mod: 'fabric-mod', file: 'fabric.jar', supportedLoaders: ['fabric'] },
    ])
  })
})