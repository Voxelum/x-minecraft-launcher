import { describe, expect, test } from 'vitest'
import { getEnabledModsWithNoDependent, getModDependents, getRequiredModDependencyIds, resolveModsToDisable, resolveModsToEnable, type ModFile } from './mod'

type ModStub = {
  modId: string
  enabled: boolean
  provides?: string[]
  deps?: { modId: string; optional?: boolean }[]
  fabricDeps?: { modId: string; optional?: boolean }[]
}

const makeMod = ({ modId, enabled, provides, deps, fabricDeps }: ModStub): ModFile => {
  const provideRuntime: Record<string, string> = {}
  for (const id of provides ?? [modId]) {
    provideRuntime[id] = '1.0.0'
  }
  return {
    modId,
    path: `/mods/${modId}.jar${enabled ? '' : '.disabled'}`,
    enabled,
    provideRuntime,
    modLoaders: fabricDeps ? ['fabric'] : ['forge'],
    name: modId,
    version: '1.0.0',
    dependencies: {
      forge: (deps ?? []).map(d => ({ modId: d.modId, versionRange: '', optional: d.optional })),
      fabric: (fabricDeps ?? []).map(d => ({ modId: d.modId, semanticVersion: '*', optional: d.optional })),
    },
  } as unknown as ModFile
}

const paths = (mods: ModFile[]) => mods.map(m => m.modId).sort()

describe('getRequiredModDependencyIds', () => {
  test('collects non-optional dependency ids across runtimes', () => {
    const mod = {
      dependencies: {
        forge: [{ modId: 'lib', versionRange: '' }, { modId: 'opt', versionRange: '', optional: true }],
        fabric: [{ modId: 'other', semanticVersion: '*' }],
      },
    } as unknown as ModFile
    expect(getRequiredModDependencyIds(mod).sort()).toEqual(['lib', 'other'])
  })

  test('deduplicates ids appearing in multiple runtimes', () => {
    const mod = {
      dependencies: {
        forge: [{ modId: 'lib', versionRange: '' }],
        neoforge: [{ modId: 'lib', versionRange: '' }],
      },
    } as unknown as ModFile
    expect(getRequiredModDependencyIds(mod)).toEqual(['lib'])
  })

  test('skips optional dependencies', () => {
    const mod = {
      dependencies: { forge: [{ modId: 'opt', versionRange: '', optional: true }] },
    } as unknown as ModFile
    expect(getRequiredModDependencyIds(mod)).toEqual([])
  })
})

describe('getEnabledModsWithNoDependent', () => {
  test('excludes disabled mods from unused candidates', () => {
    const disabledLib = makeMod({ modId: 'lib', enabled: false })

    expect(getEnabledModsWithNoDependent([disabledLib], ['forge'])).toEqual([])
  })

  test('excludes dependencies of enabled mods', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })

    expect(paths(getEnabledModsWithNoDependent([app, lib], ['forge']))).toEqual(['app'])
  })
})

describe('getModDependents', () => {
  test('matches direct mod id dependencies', () => {
    const lib = makeMod({ modId: 'lib', enabled: true })
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })

    expect(getModDependents([lib], [lib, app])).toEqual([
      expect.objectContaining({ id: 'app', title: 'app', type: 'required' }),
    ])
  })

  test('does not report dependents through provided aliases', () => {
    const ukulib = makeMod({ modId: 'ukulib', enabled: true, provides: ['ukulib', 'fabric-api'] })
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'fabric-api' }] })

    expect(getModDependents([ukulib], [ukulib, app])).toEqual([])
  })

  test('only scans matching loader dependency metadata', () => {
    const lib = makeMod({ modId: 'lib', enabled: true })
    const app = makeMod({ modId: 'app', enabled: true, fabricDeps: [{ modId: 'lib' }] })

    expect(getModDependents([lib], [lib, app])).toEqual([])
  })
})

describe('resolveModsToDisable', () => {
  test('keeps Sophisticated Storage when disabling an addon', () => {
    const addon = makeMod({ modId: 'storage_addon', enabled: true, deps: [{ modId: 'sophisticatedstorage' }] })
    expect(paths(resolveModsToDisable([addon]))).toEqual(['storage_addon'])
  })

  test('allows explicitly selecting both an addon and its parent', () => {
    const addon = makeMod({ modId: 'addon', enabled: true, deps: [{ modId: 'parent' }] })
    const parent = makeMod({ modId: 'parent', enabled: true })
    expect(resolveModsToDisable([addon, parent])).toEqual([addon, parent])
  })

  test('deduplicates selections without changing the input', () => {
    const mod = makeMod({ modId: 'mod', enabled: true })
    const selection = [mod, mod]
    expect(resolveModsToDisable(selection)).toEqual([mod])
    expect(selection).toEqual([mod, mod])
  })

  test('does not select anything for an empty selection', () => {
    expect(resolveModsToDisable([])).toEqual([])
  })

  test('keeps Terramity enabled when disabling its fix addon', () => {
    const app = makeMod({ modId: 'terramity_fix', enabled: true, deps: [{ modId: 'terramity' }] })
    const lib = makeMod({ modId: 'terramity', enabled: true })

    expect(paths(resolveModsToDisable([app]))).toEqual(['terramity_fix'])
    expect(lib.enabled).toBe(true)
  })

  test('keeps a dependency that another enabled mod still needs', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const other = makeMod({ modId: 'other', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })

    expect(paths(resolveModsToDisable([app]))).toEqual(['app'])
    expect(lib.enabled).toBe(true)
    expect(other.enabled).toBe(true)
  })

  test('keeps shared dependencies when disabling all their dependents', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const other = makeMod({ modId: 'other', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })

    expect(paths(resolveModsToDisable([app, other]))).toEqual(['app', 'other'])
    expect(lib.enabled).toBe(true)
  })

  test('keeps transitive dependencies enabled', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true, deps: [{ modId: 'core' }] })
    const core = makeMod({ modId: 'core', enabled: true })

    expect(paths(resolveModsToDisable([app]))).toEqual(['app'])
    expect(lib.enabled).toBe(true)
    expect(core.enabled).toBe(true)
  })

  test('keeps dependencies matched through provided aliases', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'api' }] })
    const lib = makeMod({ modId: 'lib', enabled: true, provides: ['lib', 'api'] })

    expect(paths(resolveModsToDisable([app]))).toEqual(['app'])
    expect(lib.enabled).toBe(true)
  })

  test('does not touch already disabled dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: false })

    expect(paths(resolveModsToDisable([app]))).toEqual(['app'])
    expect(lib.enabled).toBe(false)
  })

  test('does not follow optional dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib', optional: true }] })
    const lib = makeMod({ modId: 'lib', enabled: true })

    expect(paths(resolveModsToDisable([app]))).toEqual(['app'])
    expect(lib.enabled).toBe(true)
  })
})

describe('resolveModsToEnable', () => {
  test('enables a disabled dependency together with the mod', () => {
    const app = makeMod({ modId: 'app', enabled: false, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: false })
    const all = [app, lib]

    expect(paths(resolveModsToEnable([app], all))).toEqual(['app', 'lib'])
  })

  test('does not re-enable a dependency already satisfied by an enabled provider', () => {
    const app = makeMod({ modId: 'app', enabled: false, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })
    const all = [app, lib]

    expect(paths(resolveModsToEnable([app], all))).toEqual(['app'])
  })

  test('cascades through transitive dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: false, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: false, deps: [{ modId: 'core' }] })
    const core = makeMod({ modId: 'core', enabled: false })
    const all = [app, lib, core]

    expect(paths(resolveModsToEnable([app], all))).toEqual(['app', 'core', 'lib'])
  })

  test('does not follow optional dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: false, deps: [{ modId: 'lib', optional: true }] })
    const lib = makeMod({ modId: 'lib', enabled: false })
    const all = [app, lib]

    expect(paths(resolveModsToEnable([app], all))).toEqual(['app'])
  })

  test('does nothing when the dependency is not installed', () => {
    const app = makeMod({ modId: 'app', enabled: false, deps: [{ modId: 'missing' }] })
    const all = [app]

    expect(paths(resolveModsToEnable([app], all))).toEqual(['app'])
  })
})
