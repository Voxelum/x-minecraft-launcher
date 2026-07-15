import { describe, expect, test } from 'vitest'
import { getRequiredModDependencyIds, resolveModsToDisable, resolveModsToEnable, type ModFile } from './mod'

type ModStub = {
  modId: string
  enabled: boolean
  provides?: string[]
  deps?: { modId: string; optional?: boolean }[]
}

const makeMod = ({ modId, enabled, provides, deps }: ModStub): ModFile => {
  const provideRuntime: Record<string, string> = {}
  for (const id of provides ?? [modId]) {
    provideRuntime[id] = '1.0.0'
  }
  return {
    modId,
    path: `/mods/${modId}.jar${enabled ? '' : '.disabled'}`,
    enabled,
    provideRuntime,
    dependencies: {
      forge: (deps ?? []).map(d => ({ modId: d.modId, versionRange: '', optional: d.optional })),
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

describe('resolveModsToDisable', () => {
  test('disables an orphan dependency together with the mod', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })
    const all = [app, lib]

    expect(paths(resolveModsToDisable([app], all))).toEqual(['app', 'lib'])
  })

  test('keeps a dependency that another enabled mod still needs', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const other = makeMod({ modId: 'other', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })
    const all = [app, other, lib]

    expect(paths(resolveModsToDisable([app], all))).toEqual(['app'])
  })

  test('disables a shared dependency when all its dependents are disabled together', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const other = makeMod({ modId: 'other', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true })
    const all = [app, other, lib]

    expect(paths(resolveModsToDisable([app, other], all))).toEqual(['app', 'lib', 'other'])
  })

  test('cascades through transitive dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: true, deps: [{ modId: 'core' }] })
    const core = makeMod({ modId: 'core', enabled: true })
    const all = [app, lib, core]

    expect(paths(resolveModsToDisable([app], all))).toEqual(['app', 'core', 'lib'])
  })

  test('ignores dependencies satisfied by a mod id alias (provides)', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'api' }] })
    const lib = makeMod({ modId: 'lib', enabled: true, provides: ['lib', 'api'] })
    const all = [app, lib]

    expect(paths(resolveModsToDisable([app], all))).toEqual(['app', 'lib'])
  })

  test('does not touch already disabled dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib' }] })
    const lib = makeMod({ modId: 'lib', enabled: false })
    const all = [app, lib]

    expect(paths(resolveModsToDisable([app], all))).toEqual(['app'])
  })

  test('does not follow optional dependencies', () => {
    const app = makeMod({ modId: 'app', enabled: true, deps: [{ modId: 'lib', optional: true }] })
    const lib = makeMod({ modId: 'lib', enabled: true })
    const all = [app, lib]

    expect(paths(resolveModsToDisable([app], all))).toEqual(['app'])
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
