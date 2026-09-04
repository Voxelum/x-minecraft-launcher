import { describe, expect, test } from 'vitest'
import {
  getInstanceGroupFileName,
  getModUpgradeFilenameMappings,
  InstanceGroupStateKey,
  migrateModGroupFilenames,
} from './InstanceModsGroupService'

describe('instance content group storage', () => {
  test('keeps mod storage compatible and isolates other content types', () => {
    expect(getInstanceGroupFileName()).toBe('mod-groups.json')
    expect(getInstanceGroupFileName('resourcepacks')).toBe('resourcepacks-groups.json')
    expect(getInstanceGroupFileName('shaderpacks')).toBe('shaderpacks-groups.json')

    expect(InstanceGroupStateKey('instance')).toBe('instance-mods-group-state://instance')
    expect(InstanceGroupStateKey('instance', 'resourcepacks')).toBe('instance-resourcepacks-group-state://instance')
    expect(InstanceGroupStateKey('instance', 'shaderpacks')).toBe('instance-shaderpacks-group-state://instance')
  })
})

describe('mod group filename migration', () => {
  test('maps provider upgrades and preserves unrelated group entries', () => {
    const mappings = getModUpgradeFilenameMappings([
      { path: 'mods/sodium-old.jar.disabled', hashes: {}, modrinth: { projectId: 'sodium', versionId: 'old' } },
      { path: 'mods/jei-old.jar', hashes: {}, curseforge: { projectId: 238222, fileId: 1 } },
      { path: 'mods/local.jar', hashes: {} },
    ], [
      { path: 'mods/sodium-new.jar', hashes: {}, modrinth: { projectId: 'sodium', versionId: 'new' } },
      { path: 'mods/jei-new.jar', hashes: {}, curseforge: { projectId: 238222, fileId: 2 } },
      { path: 'mods/other.jar', hashes: {} },
    ])

    expect(mappings).toEqual({
      'sodium-old.jar': 'sodium-new.jar',
      'jei-old.jar': 'jei-new.jar',
    })

    const groups = {
      performance: { color: 'green', files: ['sodium-old.jar.disabled', 'local.jar'] },
      utility: { color: 'blue', files: ['jei-old.jar'] },
    }
    expect(migrateModGroupFilenames(groups, mappings)).toEqual({
      performance: { color: 'green', files: ['sodium-new.jar', 'local.jar'] },
      utility: { color: 'blue', files: ['jei-new.jar'] },
    })
    expect(groups.performance.files).toEqual(['sodium-old.jar.disabled', 'local.jar'])
  })

  test('returns the original groups when no filename changes apply', () => {
    const groups = { utility: { color: '', files: ['jei.jar'] } }
    expect(migrateModGroupFilenames(groups, {})).toBe(groups)
  })
})