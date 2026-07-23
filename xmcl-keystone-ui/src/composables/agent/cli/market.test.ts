import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CliContext } from './context'
import { createMarketCliOperations, createMarketCommand, type MarketCliOperations } from './market'

const clients = vi.hoisted(() => ({
  modrinth: {
    searchProjects: vi.fn(),
    getProject: vi.fn(),
    getProjectVersions: vi.fn(),
    getProjectVersionsById: vi.fn(),
  },
  curseforge: {
    searchMods: vi.fn(),
    getMod: vi.fn(),
    getModDescription: vi.fn(),
    getModFiles: vi.fn(),
    getFiles: vi.fn(),
  },
}))

vi.mock('@/util/clients', () => ({
  clientModrinthV2: clients.modrinth,
  clientCurseforgeV1: clients.curseforge,
}))

function fakeOperations(): MarketCliOperations {
  return {
    modrinthSearch: vi.fn(),
    modrinthProject: vi.fn(),
    modrinthVersions: vi.fn(),
    curseforgeSearch: vi.fn(),
    curseforgeProject: vi.fn(),
    curseforgeFiles: vi.fn(),
    install: vi.fn(),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('market CLI parsing', () => {
  test('forwards Modrinth filters and page options', async () => {
    const operations = fakeOperations()
    const command = createMarketCommand({} as CliContext, operations)
    await command.execute([
      'modrinth', 'search', 'performance mods',
      '--type', 'mod', '--game-version', '1.21.1',
      '--loader', 'fabric', '--loader', 'quilt',
      '--category', 'optimization', '--sort', 'downloads',
      '--page', '3', '--page-size', '20',
    ])

    expect(operations.modrinthSearch).toHaveBeenCalledWith({
      query: 'performance mods',
      projectType: 'mod',
      gameVersion: '1.21.1',
      loaders: ['fabric', 'quilt'],
      categories: ['optimization'],
      sort: 'downloads',
      page: 3,
      pageSize: 20,
    }, undefined)
  })

  test('forwards CurseForge pagination and installs returned URIs', async () => {
    const operations = fakeOperations()
    const command = createMarketCommand({} as CliContext, operations)
    await command.execute(['curseforge', 'files', '123', '--game-version', '1.20.1', '--page', '2', '--page-size', '25'])
    await command.execute(['install', 'resourcepacks', 'curseforge:123:456:file.zip', 'modrinth:abcdefgh:ABCDEFGH:file.zip'])

    expect(operations.curseforgeFiles).toHaveBeenCalledWith({ modId: 123, gameVersion: '1.20.1', page: 2, pageSize: 25 }, undefined)
    expect(operations.install).toHaveBeenCalledWith('resourcepacks', ['curseforge:123:456:file.zip', 'modrinth:abcdefgh:ABCDEFGH:file.zip'], undefined)
  })

  test('rejects invalid pagination without making requests', async () => {
    const operations = fakeOperations()
    const command = createMarketCommand({} as CliContext, operations)
    const result = await command.execute(['modrinth', 'search', 'sodium', '--page-size', '51'])

    expect(result).toMatchObject({ error: expect.stringContaining('--page-size cannot exceed 50') })
    expect(operations.modrinthSearch).not.toHaveBeenCalled()
  })
})

describe('market CLI operations', () => {
  function operations() {
    return createMarketCliOperations({
      currentInstance: () => ({ path: '/instance', runtime: { minecraft: '1.21.1' } }) as any,
      instanceChanges: { add: vi.fn(), status: vi.fn(), apply: vi.fn(), reset: vi.fn() },
      modpackService: { installModapckFromMarket: vi.fn() },
    })
  }

  test('uses API offsets and preserves complete Modrinth search records', async () => {
    const hit = { project_id: 'abcdefgh', title: 'Project', gallery: ['one', 'two'], monetization_status: 'monetized' }
    clients.modrinth.searchProjects.mockResolvedValue({ total_hits: 42, offset: 20, limit: 10, hits: [hit] })

    const result = await operations().modrinthSearch({ query: 'project', page: 3, pageSize: 10 }) as any

    expect(clients.modrinth.searchProjects).toHaveBeenCalledWith(expect.objectContaining({ offset: 20, limit: 10 }), undefined)
    expect(result.pagination).toMatchObject({ page: 3, pageSize: 10, totalCount: 42, totalPages: 5, hasNext: true })
    expect(result.projects[0]).toBe(hit)
    expect(result.projects[0].gallery).toEqual(['one', 'two'])
  })

  test('uses CurseForge file offsets and preserves file metadata', async () => {
    const file = { id: 456, fileName: 'file.jar', dependencies: [{ modId: 1, relationType: 3 }], modules: [{ name: 'module', fingerprint: 9 }] }
    clients.curseforge.getModFiles.mockResolvedValue({
      data: [file],
      pagination: { index: 10, pageSize: 10, resultCount: 1, totalCount: 21 },
    })

    const result = await operations().curseforgeFiles({ modId: 123, page: 2, pageSize: 10 }) as any

    expect(clients.curseforge.getModFiles).toHaveBeenCalledWith(expect.objectContaining({ modId: 123, index: 10, pageSize: 10 }), undefined)
    expect(result.pagination).toMatchObject({ page: 2, totalCount: 21, totalPages: 3, hasPrevious: true, hasNext: true })
    expect(result.files[0]).toMatchObject({ ...file, installUri: 'curseforge:123:456:file.jar' })
  })
})
