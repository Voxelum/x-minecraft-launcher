import { describe, expect, test } from 'vitest'
import { getInstanceManifestFingerprintSource, mergeInstanceInstallManifest, type InstanceFile } from './files'

function file(path: string, projectId?: string, versionId = 'v1'): InstanceFile {
  return {
    path,
    hashes: { sha1: `${path}-${versionId}` },
    modrinth: projectId ? { projectId, versionId } : undefined,
  }
}

describe('mergeInstanceInstallManifest', () => {
  test('accumulates independent staged files', () => {
    const first = mergeInstanceInstallManifest(undefined, { oldFiles: [], files: [file('mods/a.jar')] }, 1)
    const second = mergeInstanceInstallManifest(first, { oldFiles: [], files: [file('resourcepacks/b.zip')] }, 2)

    expect(second).toMatchObject({
      createdAt: 1,
      updatedAt: 2,
      oldFiles: [],
    })
    expect(second.files.map(value => value.path)).toEqual(['mods/a.jar', 'resourcepacks/b.zip'])
  })

  test('keeps only the latest staged version of one project', () => {
    const first = mergeInstanceInstallManifest(undefined, { oldFiles: [], files: [file('mods/a-v1.jar', 'a', 'v1')] }, 1)
    const second = mergeInstanceInstallManifest(first, { oldFiles: [], files: [file('mods/a-v2.jar', 'a', 'v2')] }, 2)

    expect(second.files).toEqual([file('mods/a-v2.jar', 'a', 'v2')])
  })

  test('collapses an update of a staged file without removing a nonexistent file', () => {
    const first = mergeInstanceInstallManifest(undefined, { oldFiles: [], files: [file('mods/a-v1.jar', 'a', 'v1')] }, 1)
    const second = mergeInstanceInstallManifest(first, {
      oldFiles: [file('mods/a-v1.jar', 'a', 'v1')],
      files: [file('mods/a-v2.jar', 'a', 'v2')],
    }, 2)

    expect(second.oldFiles).toEqual([])
    expect(second.files).toEqual([file('mods/a-v2.jar', 'a', 'v2')])
  })

  test('preserves the original installed file across repeated updates', () => {
    const installed = file('mods/a-v1.jar', 'a', 'v1')
    const first = mergeInstanceInstallManifest(undefined, {
      oldFiles: [installed],
      files: [file('mods/a-v2.jar', 'a', 'v2')],
    }, 1)
    const second = mergeInstanceInstallManifest(first, {
      oldFiles: [file('mods/a-v2.jar', 'a', 'v2')],
      files: [file('mods/a-v3.jar', 'a', 'v3')],
    }, 2)

    expect(second.oldFiles).toEqual([installed])
    expect(second.files).toEqual([file('mods/a-v3.jar', 'a', 'v3')])
  })

  test('does not confuse an installed version with a different staged version of the same project', () => {
    const staged = mergeInstanceInstallManifest(undefined, {
      oldFiles: [],
      files: [file('mods/a-v2.jar', 'a', 'v2')],
    }, 1)
    const updated = mergeInstanceInstallManifest(staged, {
      oldFiles: [file('mods/a-v1.jar', 'a', 'v1')],
      files: [file('mods/a-v3.jar', 'a', 'v3')],
    }, 2)

    expect(updated.oldFiles).toEqual([file('mods/a-v1.jar', 'a', 'v1')])
    expect(updated.files).toEqual([file('mods/a-v3.jar', 'a', 'v3')])
  })
})

describe('getInstanceManifestFingerprintSource', () => {
  const manifest = (files: InstanceFile[], fabricLoader = '0.16.10') => ({
    runtime: { minecraft: '1.21.1', fabricLoader },
    files,
  } as any)
  const mod = (path: string, sha1: string): InstanceFile => ({ path, hashes: { sha1 } })

  it('matches renamed mods while preserving content, state, and multiplicity', () => {
    const source = getInstanceManifestFingerprintSource(manifest([
      mod('mods/a.jar', 'a'),
      mod('mods/b.jar.disabled', 'b'),
      mod('config/options.json', 'ignored'),
    ]))

    expect(getInstanceManifestFingerprintSource(manifest([
      mod('mods/renamed.jar.disabled', 'b'),
      mod('mods/other-name.jar', 'a'),
    ]))).toBe(source)
    expect(getInstanceManifestFingerprintSource(manifest([
      mod('mods/a.jar', 'a'),
      mod('mods/b.jar', 'b'),
    ]))).not.toBe(source)
    expect(getInstanceManifestFingerprintSource(manifest([
      mod('mods/a.jar', 'a'),
      mod('mods/b.jar.disabled', 'different'),
    ]))).not.toBe(source)
    expect(getInstanceManifestFingerprintSource(manifest([
      mod('mods/a.jar', 'a'),
      mod('mods/b.jar.disabled', 'b'),
      mod('mods/copy.jar', 'a'),
    ]))).not.toBe(source)
    expect(getInstanceManifestFingerprintSource(manifest([
      mod('mods/a.jar', 'a'),
      mod('mods/b.jar.disabled', 'b'),
    ], '0.16.9'))).not.toBe(source)
  })
})