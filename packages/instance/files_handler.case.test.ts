import { describe, expect, it } from 'vitest'
import { assertNoCaseInsensitivePathCollisions } from './files_handler'

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
