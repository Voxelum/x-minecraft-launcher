import { describe, expect, test } from 'vitest'
import type { InstanceFile } from '@xmcl/instance'
import type { ModFile } from '@/util/mod'
import {
  deduplicateModDependencyInstallations,
  getModDependencyIdentity,
  hasDisabledModDependencyMatch,
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

  test('deduplicates same mod requested from both Modrinth and CurseForge', () => {
    const fromModrinth: InstanceFile = {
      path: 'mods/fabric-api-0.100.4+1.21.jar',
      hashes: { sha1: 'hash-m' },
      modrinth: { projectId: 'P7dR8mSH', versionId: 'v1' },
    }
    const fromCurseforge: InstanceFile = {
      path: 'mods/fabric-api-0.100.2+1.21.jar',
      hashes: { sha1: 'hash-cf' },
      curseforge: { projectId: 306612, fileId: 999 },
    }

    expect(deduplicateModDependencyInstallations([
      installation(fromModrinth),
      installation(fromCurseforge),
    ])).toEqual([installation(fromModrinth)])
  })

  test('skips dependencies already installed via another platform or local jar', () => {
    const candidate: InstanceFile = {
      path: 'mods/cloth-config-15.0.140-fabric.jar',
      hashes: { sha1: 'new-hash' },
      modrinth: { projectId: '9s6osm5g', versionId: 'v140' },
    }
    const installedLocal = {
      path: '/instance/mods/cloth-config-15.0.130-fabric.jar',
      fileName: 'cloth-config-15.0.130-fabric.jar',
      hash: 'old-hash',
      enabled: true,
      modId: 'cloth-config',
      provideRuntime: { 'cloth-config': '15.0.130' },
    } as unknown as ModFile

    expect(deduplicateModDependencyInstallations([
      installation(candidate),
    ], [installedLocal])).toEqual([])
  })

  test('keeps disabled local dependencies unresolved and flags them for manual review', () => {
    const candidate: InstanceFile = { path: 'mods/cloth-config-15.0.140-fabric.jar', hashes: {} }
    const disabled = {
      path: '/instance/mods/cloth-config-15.0.130-fabric.jar.disabled',
      enabled: false,
      modId: 'cloth-config',
    } as ModFile

    expect(deduplicateModDependencyInstallations([installation(candidate)], [disabled])).toEqual([installation(candidate)])
    expect(hasDisabledModDependencyMatch(candidate, [disabled])).toBe(true)
    expect(hasDisabledModDependencyMatch({ path: 'mods/unrelated-1.jar', hashes: {} }, [disabled])).toBe(false)
  })
})
