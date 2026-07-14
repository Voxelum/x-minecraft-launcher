import { describe, expect, test, vi } from 'vitest'
import type { CollectionEntry } from '@xmcl/runtime-api'
import { resolveCollectionEntry, resolveCurseforgeEntry, resolveModrinthEntry } from './collectionResolver'

const target = { minecraft: '1.20.1', loaders: ['fabric'], contentType: 'mods' as const }

describe('resolveModrinthEntry', () => {
  const entry: CollectionEntry = { provider: 'modrinth', projectId: 'AABB' }

  test('resolves the newest compatible version', async () => {
    const client = {
      getProjectVersions: vi.fn().mockResolvedValue([{ id: 'v-new' }, { id: 'v-old' }]),
    }
    const result = await resolveModrinthEntry(entry, target, client)
    expect(result.candidate).toMatchObject({ provider: 'modrinth', versionId: 'v-new' })
    expect((result.candidate as any).version).toEqual({ id: 'v-new' })
    expect(client.getProjectVersions).toHaveBeenCalledWith('AABB', {
      gameVersions: ['1.20.1'],
      loaders: ['fabric'],
    }, undefined)
  })

  test('does not filter resource packs by loader', async () => {
    const client = { getProjectVersions: vi.fn().mockResolvedValue([{ id: 'rp' }]) }
    await resolveModrinthEntry(entry, { ...target, contentType: 'resourcepacks' }, client)
    expect(client.getProjectVersions).toHaveBeenCalledWith('AABB', {
      gameVersions: ['1.20.1'],
      loaders: undefined,
    }, undefined)
  })

  test('reports incompatible when no version matches', async () => {
    const client = { getProjectVersions: vi.fn().mockResolvedValue([]) }
    const result = await resolveModrinthEntry(entry, target, client)
    expect(result.candidate).toBeUndefined()
    expect(result.reason).toBe('incompatible')
  })

  test('reports error on provider failure', async () => {
    const client = { getProjectVersions: vi.fn().mockRejectedValue(new Error('boom')) }
    const result = await resolveModrinthEntry(entry, target, client)
    expect(result.reason).toBe('error')
    expect((result.error as Error).message).toBe('boom')
  })
})

describe('resolveCurseforgeEntry', () => {
  const entry: CollectionEntry = { provider: 'curseforge', projectId: '12345' }

  test('resolves the newest compatible file', async () => {
    const client = { getModFiles: vi.fn().mockResolvedValue({ data: [{ id: 111 }, { id: 110 }] }) }
    const result = await resolveCurseforgeEntry(entry, target, client)
    expect(result.candidate).toMatchObject({ provider: 'curseforge', fileId: 111 })
    expect((result.candidate as any).file).toEqual({ id: 111 })
    expect(client.getModFiles).toHaveBeenCalledWith(expect.objectContaining({ modId: 12345, gameVersion: '1.20.1' }), undefined)
  })

  test('reports not-found for a non-numeric project id', async () => {
    const client = { getModFiles: vi.fn() }
    const result = await resolveCurseforgeEntry({ provider: 'curseforge', projectId: 'abc' }, target, client)
    expect(result.reason).toBe('not-found')
    expect(client.getModFiles).not.toHaveBeenCalled()
  })

  test('reports incompatible when no file matches', async () => {
    const client = { getModFiles: vi.fn().mockResolvedValue({ data: [] }) }
    const result = await resolveCurseforgeEntry(entry, target, client)
    expect(result.reason).toBe('incompatible')
  })
})

describe('resolveCollectionEntry', () => {
  test('dispatches to the correct provider', async () => {
    const modrinth = { getProjectVersions: vi.fn().mockResolvedValue([{ id: 'm' }]) }
    const curseforge = { getModFiles: vi.fn().mockResolvedValue({ data: [{ id: 1 }] }) }
    const clients = { modrinth, curseforge }

    const m = await resolveCollectionEntry({ provider: 'modrinth', projectId: 'p' }, target, clients)
    expect(m.candidate?.provider).toBe('modrinth')
    expect(curseforge.getModFiles).not.toHaveBeenCalled()

    const c = await resolveCollectionEntry({ provider: 'curseforge', projectId: '9' }, target, clients)
    expect(c.candidate?.provider).toBe('curseforge')
  })
})
