import { describe, expect, it } from 'vitest'
import type { InstanceFileUpdate } from './files'
import { assertNoCaseInsensitivePathCollisions, assertNoCaseInsensitiveUpdatePathCollisions } from './files_handler'

const update = (path: string, operation: InstanceFileUpdate['operation']): InstanceFileUpdate => ({
  file: { path, hashes: {} },
  operation,
})

describe('assertNoCaseInsensitivePathCollisions', () => {
  it('rejects paths that only differ by letter case on a case-insensitive filesystem', () => {
    expect(() => assertNoCaseInsensitivePathCollisions(
      ['resources/contenttweaker/models/item/coinT1.json', 'resources/contenttweaker/models/item/coint1.json'],
      true,
    )).toThrow(/differ only by letter case/)
  })

  it('allows the same archive paths on a case-sensitive filesystem', () => {
    expect(() => assertNoCaseInsensitivePathCollisions(
      ['resources/contenttweaker/models/item/coinT1.json', 'resources/contenttweaker/models/item/coint1.json'],
      false,
    )).not.toThrow()
  })
})

describe('assertNoCaseInsensitiveUpdatePathCollisions', () => {
  it('allows an update to replace a removed path with different letter casing', () => {
    expect(() => assertNoCaseInsensitiveUpdatePathCollisions([
      update('config/TheSkyHive/settings.json', 'remove'),
      update('config/TheSkyhive/settings.json', 'add'),
    ], true)).not.toThrow()
  })

  it('rejects paths that would coexist after the update', () => {
    expect(() => assertNoCaseInsensitiveUpdatePathCollisions([
      update('config/TheSkyHive/settings.json', 'keep'),
      update('config/TheSkyhive/settings.json', 'add'),
    ], true)).toThrow(/differ only by letter case/)
  })
})
