import { describe, expect, it } from 'vitest'

export function validateCollectionImport(parsed: any) {
  if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim() || (parsed.description !== undefined && typeof parsed.description !== 'string')) {
    throw new Error('Invalid collection metadata')
  }
  for (const contentType of ['mods', 'resourcepacks', 'shaderpacks'] as const) {
    const entries = parsed[contentType]
    if (entries !== undefined && (!Array.isArray(entries) || entries.some((entry: any) =>
      !entry || (entry.provider !== 'modrinth' && entry.provider !== 'curseforge') ||
      typeof entry.projectId !== 'string' || entry.projectId.length === 0
    ))) {
      throw new Error('Invalid collection entries')
    }
  }
  return true
}

describe('AppLocalCollectionList import validation', () => {
  it('accepts valid collection json', () => {
    const valid = {
      name: 'My Collection',
      description: 'A great collection',
      mods: [{ provider: 'modrinth', projectId: 'sodium' }],
      resourcepacks: [],
      shaderpacks: [{ provider: 'curseforge', projectId: '12345' }],
    }
    expect(validateCollectionImport(valid)).toBe(true)
  })

  it('rejects invalid names or non-string descriptions to protect collections schema', () => {
    expect(() => validateCollectionImport(null)).toThrow('Invalid collection metadata')
    expect(() => validateCollectionImport({ name: '' })).toThrow('Invalid collection metadata')
    expect(() => validateCollectionImport({ name: '   ' })).toThrow('Invalid collection metadata')
    expect(() => validateCollectionImport({ name: 'Valid', description: 123 })).toThrow('Invalid collection metadata')
    expect(() => validateCollectionImport({ name: 'Valid', description: {} })).toThrow('Invalid collection metadata')
  })

  it('rejects entries with invalid providers or missing/non-string projectIds', () => {
    expect(() => validateCollectionImport({
      name: 'Test',
      mods: [{ provider: 'invalid', projectId: 'sodium' }],
    })).toThrow('Invalid collection entries')

    expect(() => validateCollectionImport({
      name: 'Test',
      mods: [{ provider: 'modrinth', projectId: '' }],
    })).toThrow('Invalid collection entries')

    expect(() => validateCollectionImport({
      name: 'Test',
      mods: [{ provider: 'modrinth', projectId: 12345 }],
    })).toThrow('Invalid collection entries')
  })
})
