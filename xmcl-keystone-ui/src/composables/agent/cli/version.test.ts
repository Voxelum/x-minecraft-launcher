import { describe, expect, test, vi } from 'vitest'
import { createVersionCommand } from './version'

function setup(overrides: Record<string, unknown> = {}) {
  const metadata = {
    getMinecraftVersions: vi.fn().mockResolvedValue({ latest: { release: '1.21.1', snapshot: '25w01a' }, versions: [] }),
    getForgeVersions: vi.fn().mockResolvedValue([]),
    getNeoForgedVersions: vi.fn().mockResolvedValue([]),
    getFabricVersions: vi.fn().mockResolvedValue({ gameVersions: [], loaderVersions: [] }),
    getQuiltVersions: vi.fn().mockResolvedValue({ gameVersions: [], loaderVersions: [] }),
    getOptifineVersions: vi.fn().mockResolvedValue([]),
    getLabyModManifest: vi.fn().mockResolvedValue({ labyModVersion: '4', minecraftVersions: [] }),
    ...overrides,
  }
  const versions = {
    getLocalVersions: vi.fn().mockResolvedValue({ local: [], servers: [] }),
  }
  return { command: createVersionCommand({ metadata, versions }), metadata, versions }
}

describe('version CLI', () => {
  test('lists and paginates remote Minecraft versions', async () => {
    const remote = Array.from({ length: 25 }, (_, index) => ({ id: `1.${25 - index}`, type: index === 0 ? 'snapshot' : 'release' }))
    const { command, metadata } = setup({
      getMinecraftVersions: vi.fn().mockResolvedValue({ latest: { release: '1.24', snapshot: '1.25' }, versions: remote }),
    })
    const result = await command.execute(['list', 'minecraft', '--type', 'release', '--page', '2', '--page-size', '10', '--refresh']) as any

    expect(metadata.getMinecraftVersions).toHaveBeenCalledWith(true)
    expect(result).toMatchObject({
      provider: 'minecraft',
      type: 'release',
      pagination: { page: 2, pageSize: 10, resultCount: 10, totalCount: 24, totalPages: 3, hasPrevious: true, hasNext: true },
    })
  })

  test('requires Minecraft version for Forge and NeoForge', async () => {
    const { command, metadata } = setup({
      getForgeVersions: vi.fn().mockResolvedValue([{ mcversion: '1.20.1', version: '47.3.0' }]),
    })
    expect(await command.execute(['list', 'forge'])).toMatchObject({ error: expect.stringContaining('requires one Minecraft version') })
    const result = await command.execute(['list', 'forge', '1.20.1']) as any
    expect(metadata.getForgeVersions).toHaveBeenCalledWith('1.20.1', false)
    expect(result.versions[0].version).toBe('47.3.0')
  })

  test('filters Fabric loaders and reports supported game versions', async () => {
    const { command } = setup({
      getFabricVersions: vi.fn().mockResolvedValue({
        gameVersions: ['1.20.1', '1.21.1'],
        loaderVersions: [
          { version: '0.16.0', stable: true },
          { version: '0.17.0-beta', stable: false },
        ],
      }),
    })
    const result = await command.execute(['list', 'fabric', '1.21.1', '--stable']) as any
    expect(result.gameVersions).toEqual(['1.20.1', '1.21.1'])
    expect(result.versions).toEqual([{ version: '0.16.0', stable: true }])
  })

  test('lists local client and server versions with loader filtering', async () => {
    const { command, versions } = setup()
    versions.getLocalVersions.mockResolvedValue({
      local: [
        { id: 'vanilla', minecraft: '1.21.1', forge: '', fabric: '', quilt: '', neoForged: '' },
        { id: 'forge', minecraft: '1.20.1', forge: '47.3.0', fabric: '', quilt: '', neoForged: '' },
      ],
      servers: [{ id: 'server', minecraft: '1.21.1', type: 'vanilla' }],
    })

    const clients = await command.execute(['list', 'local', '--type', 'forge']) as any
    const servers = await command.execute(['list', 'local', '--server']) as any
    expect(clients.versions.map((version: any) => version.id)).toEqual(['forge'])
    expect(servers.versions.map((version: any) => version.id)).toEqual(['server'])
  })

  test('validates page size and unknown providers', async () => {
    const { command } = setup()
    expect(await command.execute(['list', 'minecraft', '--page-size', '101'])).toMatchObject({ error: expect.stringContaining('cannot exceed 100') })
    expect(await command.execute(['list', 'unknown'])).toMatchObject({ error: expect.stringContaining('Unknown version provider') })
  })
})
