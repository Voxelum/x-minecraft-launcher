import { describe, expect, test } from 'vitest'
import { buildModUpgradeManifest } from './modUpgradeManifest'

describe('mod upgrade manifest', () => {
  test('builds provider files while preserving provider identity on replaced files', () => {
    const plans = [
      {
        mod: { fileName: 'sodium-old.jar.disabled', hash: 'old-sha1', size: 12, modrinth: { projectId: 'sodium', versionId: 'old-version' } },
        version: {
          id: 'sodium-version',
          project_id: 'sodium',
          files: [{ filename: 'sodium-new.jar', primary: true, hashes: { sha1: 'new-sha1' } }],
        },
      },
      {
        mod: { fileName: 'jei-old.jar', hash: 'jei-old-sha1', size: 24, curseforge: { projectId: 238222, fileId: 1 } },
        file: {
          id: 2,
          modId: 238222,
          fileName: 'jei-new.jar',
          fileLength: 32,
          hashes: [{ algo: 1, value: 'jei-new-sha1' }],
        },
      },
    ] as any

    expect(buildModUpgradeManifest(plans)).toEqual({
      oldFiles: [
        { path: 'mods/sodium-old.jar.disabled', hashes: { sha1: 'old-sha1' }, size: 12, modrinth: { projectId: 'sodium', versionId: 'old-version' } },
        { path: 'mods/jei-old.jar', hashes: { sha1: 'jei-old-sha1' }, size: 24, curseforge: { projectId: 238222, fileId: 1 } },
      ],
      files: [
        expect.objectContaining({ path: 'mods/sodium-new.jar', modrinth: { projectId: 'sodium', versionId: 'sodium-version' } }),
        expect.objectContaining({ path: 'mods/jei-new.jar', curseforge: { projectId: 238222, fileId: 2 } }),
      ],
    })
  })
})