import { describe, expect, it } from 'vitest'
import { createLayeredLinearBackup, createLayeredLinearBackupObject } from './layered-linear-backup'
import { createLinearBackup, createLinearBackupObject, readLinearBackup } from './linear-backup'

const sha256 = 'A'.repeat(64)

describe('Linear backup object declarations', () => {
  it('creates a normalized linear declaration from compressed object metadata', () => {
    expect(createLinearBackupObject({ sizeBytes: 42, sha256 })).toEqual({
      format: 'linear',
      formatVersion: 1,
      sizeBytes: 42,
      sha256: sha256.toLowerCase(),
    })
  })

  it('requires a parent for a layered declaration', () => {
    expect(() =>
      createLayeredLinearBackupObject({ parentBackupId: ' ', sizeBytes: 42, sha256 }),
    ).toThrow('parentBackupId')
  })

  it.each([
    [{ sizeBytes: 0, sha256 }, 'sizeBytes'],
    [{ sizeBytes: 42, sha256: 'not-a-digest' }, 'sha256'],
    [{ formatVersion: 2, sizeBytes: 42, sha256 }, 'format version'],
  ])('rejects an invalid declaration %#', (input, message) => {
    expect(() => createLinearBackupObject(input)).toThrow(message)
  })

  it('creates a layered declaration without deriving server-owned usage', () => {
    const declaration = createLayeredLinearBackupObject({
      parentBackupId: 'backup-parent',
      sizeBytes: 21,
      sha256,
    })

    expect(declaration).toEqual({
      format: 'layered_linear',
      formatVersion: 1,
      parentBackupId: 'backup-parent',
      sizeBytes: 21,
      sha256: sha256.toLowerCase(),
    })
    expect(declaration).not.toHaveProperty('usedBytes')
    expect(declaration).not.toHaveProperty('overageBytes')
  })

  it('serializes a deterministic compressed object instead of a world directory or zip', () => {
    const prepared = createLinearBackup([
      { path: 'region/r.0.0.mca', content: new Uint8Array([1, 2]) },
      { path: 'level.dat', content: new Uint8Array([3]) },
    ])

    expect(prepared.object).toMatchObject({ format: 'linear', formatVersion: 1 })
    expect(Array.from(prepared.content.subarray(0, 2))).toEqual([0x1f, 0x8b])
    expect(readLinearBackup(prepared.content)).toEqual([
      { path: 'level.dat', content: new Uint8Array([3]) },
      { path: 'region/r.0.0.mca', content: new Uint8Array([1, 2]) },
    ])
  })

  it('binds a compressed layer to its parent without treating it as storage usage', () => {
    const prepared = createLayeredLinearBackup([{ path: 'level.dat', content: new Uint8Array([1]) }], 'base')
    expect(prepared.object).toMatchObject({ format: 'layered_linear', parentBackupId: 'base' })
    expect(prepared.object).not.toHaveProperty('usedBytes')
  })

  it.each([
    'C:/level.dat',
    '../level.dat',
    'region\\r.0.0.mca',
    'level.dat',
  ])('rejects unsafe or duplicate snapshot entries: %s', (path) => {
    const entries = path === 'level.dat'
      ? [{ path, content: new Uint8Array() }, { path, content: new Uint8Array() }]
      : [{ path, content: new Uint8Array() }]
    expect(() => createLinearBackup(entries)).toThrow()
  })
})