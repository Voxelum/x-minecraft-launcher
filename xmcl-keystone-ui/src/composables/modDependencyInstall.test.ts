import { describe, expect, test } from 'vitest'
import type { InstanceFile } from '@xmcl/instance'
import type { ModFile } from '@/util/mod'
import {
  deduplicateModDependencyInstallations,
  getModDependencyIdentity,
} from './modDependencyInstall'

function installation(file: InstanceFile): [InstanceFile, ModFile] {
  return [file, {} as ModFile]
}

describe('mod dependency install planning', () => {
  test('keeps one version for a shared Modrinth dependency project', () => {
    const older: InstanceFile = {
      path: 'mods/yacl-3.9.5.jar',
      hashes: { sha1: 'older' },
      modrinth: { projectId: 'yacl', versionId: '3.9.5' },
    }
    const newer: InstanceFile = {
      path: 'mods/yacl-3.9.6.jar',
      hashes: { sha1: 'newer' },
      modrinth: { projectId: 'yacl', versionId: '3.9.6' },
    }

    expect(deduplicateModDependencyInstallations([
      installation(older),
      installation(newer),
    ])).toEqual([installation(older)])
  })

  test('does not merge different dependency projects', () => {
    const modrinth: InstanceFile = {
      path: 'mods/yacl.jar',
      hashes: { sha1: 'a' },
      modrinth: { projectId: 'yacl', versionId: 'v1' },
    }
    const curseforge: InstanceFile = {
      path: 'mods/another-config.jar',
      hashes: { sha1: 'b' },
      curseforge: { projectId: 123, fileId: 456 },
    }

    expect(getModDependencyIdentity(modrinth)).not.toBe(getModDependencyIdentity(curseforge))
    expect(deduplicateModDependencyInstallations([
      installation(modrinth),
      installation(curseforge),
    ])).toHaveLength(2)
  })
})
