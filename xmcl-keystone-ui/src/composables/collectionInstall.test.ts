import { describe, expect, test, vi } from 'vitest'
import type { CollectionEntry } from '@xmcl/runtime-api'
import { MarketType } from '@xmcl/runtime-api'
import { candidateToInstanceFile, candidateToMarketOption, getRetryableEntries, marketItemsToEntries, resolveCollectionFiles, runBulkInstall } from './collectionInstall'
import type { ResolveResult, ResolvedCandidate } from './collectionResolver'

function modrinth(projectId: string): CollectionEntry {
  return { provider: 'modrinth', projectId }
}

function candidate(versionId: string): ResolvedCandidate {
  return { provider: 'modrinth', versionId, version: { id: versionId } as any }
}

describe('runBulkInstall', () => {
  test('installs resolved entries and aggregates counts', async () => {
    const install = vi.fn().mockResolvedValue(undefined)
    const result = await runBulkInstall([modrinth('a'), modrinth('b')], {
      resolve: async (e): Promise<ResolveResult> => ({ entry: e, candidate: candidate('v-' + e.projectId) }),
      isInstalled: () => false,
      install,
    })
    expect(result.installed).toHaveLength(2)
    expect(install).toHaveBeenCalledTimes(2)
    expect(result.cancelled).toBe(false)
  })

  test('deduplicates identical provider + projectId entries', async () => {
    const install = vi.fn().mockResolvedValue(undefined)
    const result = await runBulkInstall([modrinth('a'), modrinth('a')], {
      resolve: async (e) => ({ entry: e, candidate: candidate('v') }),
      isInstalled: () => false,
      install,
    })
    expect(install).toHaveBeenCalledTimes(1)
    expect(result.installed).toHaveLength(1)
  })

  test('skips already installed entries without resolving', async () => {
    const resolve = vi.fn(async (e: CollectionEntry) => ({ entry: e, candidate: candidate('v') }))
    const result = await runBulkInstall([modrinth('a')], {
      resolve,
      isInstalled: () => true,
      install: vi.fn(),
    })
    expect(result.alreadyInstalled).toHaveLength(1)
    expect(resolve).not.toHaveBeenCalled()
  })

  test('records incompatible/missing entries as skipped with a reason', async () => {
    const result = await runBulkInstall([modrinth('a')], {
      resolve: async (e) => ({ entry: e, reason: 'incompatible' }),
      isInstalled: () => false,
      install: vi.fn(),
    })
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toMatch(/compatible/i)
  })

  test('continues after an individual install failure', async () => {
    const install = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined)
    const result = await runBulkInstall([modrinth('a'), modrinth('b')], {
      resolve: async (e) => ({ entry: e, candidate: candidate('v') }),
      isInstalled: () => false,
      install,
    })
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].reason).toBe('network down')
    expect(result.installed).toHaveLength(1)
  })

  test('reports progress for each entry', async () => {
    const onProgress = vi.fn()
    await runBulkInstall([modrinth('a'), modrinth('b')], {
      resolve: async (e) => ({ entry: e, candidate: candidate('v') }),
      isInstalled: () => false,
      install: vi.fn().mockResolvedValue(undefined),
      onProgress,
    })
    const last = onProgress.mock.calls.at(-1)![0]
    expect(last.total).toBe(2)
    expect(last.completed).toBe(2)
  })

  test('cancellation leaves completed installs intact and marks the run cancelled', async () => {
    const controller = new AbortController()
    const install = vi.fn().mockImplementation(async () => { controller.abort() })
    const result = await runBulkInstall([modrinth('a'), modrinth('b'), modrinth('c')], {
      resolve: async (e) => ({ entry: e, candidate: candidate('v') }),
      isInstalled: () => false,
      install,
      signal: controller.signal,
    })
    expect(result.installed).toHaveLength(1)
    expect(result.cancelled).toBe(true)
  })

  test('getRetryableEntries returns failed and skipped entries', async () => {
    const result = await runBulkInstall([modrinth('a'), modrinth('b')], {
      resolve: async (e) => e.projectId === 'a'
        ? { entry: e, reason: 'incompatible' }
        : { entry: e, candidate: candidate('v') },
      isInstalled: () => false,
      install: vi.fn().mockRejectedValue(new Error('x')),
    })
    const retry = getRetryableEntries(result)
    expect(retry).toHaveLength(2)
  })
})

describe('candidateToMarketOption', () => {
  test('builds a Modrinth option', () => {
    const opt = candidateToMarketOption({ provider: 'modrinth', versionId: 'v1', version: { id: 'v1' } as any }, '/inst') as any
    expect(opt.market).toBe(MarketType.Modrinth)
    expect(opt.version).toEqual([{ versionId: 'v1', icon: undefined }])
    expect(opt.instancePath).toBe('/inst')
  })

  test('builds a CurseForge option', () => {
    const opt = candidateToMarketOption({ provider: 'curseforge', fileId: 42, file: { id: 42 } as any }, '/inst') as any
    expect(opt.market).toBe(MarketType.CurseForge)
    expect(opt.file).toEqual([{ fileId: 42, icon: undefined }])
  })
})

describe('marketItemsToEntries', () => {
  test('maps modrinth and curseforge market items to provider-qualified entries', () => {
    const entries = marketItemsToEntries([
      { modrinthProjectId: 'AABB' } as any,
      { modrinth: { project_id: 'CCDD' } } as any,
      { curseforgeProjectId: 123 } as any,
      { curseforge: { id: 456 } } as any,
    ])
    expect(entries).toEqual([
      { provider: 'modrinth', projectId: 'AABB' },
      { provider: 'modrinth', projectId: 'CCDD' },
      { provider: 'curseforge', projectId: '123' },
      { provider: 'curseforge', projectId: '456' },
    ])
  })

  test('deduplicates and prefers modrinth when both ids present', () => {
    const entries = marketItemsToEntries([
      { modrinthProjectId: 'X', curseforgeProjectId: 9 } as any,
      { modrinthProjectId: 'X' } as any,
    ])
    expect(entries).toEqual([{ provider: 'modrinth', projectId: 'X' }])
  })
})

describe('candidateToInstanceFile', () => {
  const modrinthCandidate: ResolvedCandidate = {
    provider: 'modrinth',
    versionId: 'v',
    version: { project_id: 'p', id: 'v', files: [{ filename: 'cool.zip', hashes: { sha1: 'abc' }, primary: true }] } as any,
  }

  test('places a Modrinth resource pack in the resourcepacks folder', () => {
    const file = candidateToInstanceFile(modrinthCandidate, 'resourcepacks')
    expect(file.path).toBe('resourcepacks/cool.zip')
    expect(file.modrinth).toEqual({ projectId: 'p', versionId: 'v' })
  })

  test('places a Modrinth mod in the mods folder', () => {
    const file = candidateToInstanceFile(modrinthCandidate, 'mods')
    expect(file.path).toBe('mods/cool.zip')
  })

  test('builds a CurseForge shader file in the shaderpacks folder', () => {
    const candidate: ResolvedCandidate = {
      provider: 'curseforge',
      fileId: 5,
      file: { id: 5, modId: 7, fileName: 'shader.zip', fileLength: 10, hashes: [{ algo: 1, value: 'h' }] } as any,
    }
    const file = candidateToInstanceFile(candidate, 'shaderpacks')
    expect(file.path).toBe('shaderpacks/shader.zip')
    expect(file.curseforge).toEqual({ projectId: 7, fileId: 5 })
  })
})

describe('resolveCollectionFiles', () => {
  test('builds files for compatible entries and collects skipped with reasons', async () => {
    const result = await resolveCollectionFiles(
      [modrinth('a'), modrinth('b'), modrinth('b')],
      'mods',
      async (e) => e.projectId === 'a'
        ? { entry: e, candidate: { provider: 'modrinth', versionId: 'v', version: { project_id: 'a', id: 'v', files: [{ filename: 'a.jar', hashes: { sha1: 'x' }, primary: true }] } as any } }
        : { entry: e, reason: 'incompatible' },
    )
    // 'b' deduped to one skipped entry.
    expect(result.files).toHaveLength(1)
    expect(result.files[0].path).toBe('mods/a.jar')
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toMatch(/compatible/i)
  })
})
