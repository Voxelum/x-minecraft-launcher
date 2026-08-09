import { describe, expect, test, vi } from 'vitest'
import { resolveArtifactModrinthDependencies } from './modArtifactDependencies'

describe('artifact mod dependencies', () => {
  test('resolves exact missing Modrinth projects for the selected runtime', async () => {
    const searchProjects = vi.fn(async ({ query }: { query: string }) => ({
      hits: query === 'sodium'
        ? [
            { slug: 'sodium-extra', project_id: 'wrong' },
            { slug: 'Sodium', project_id: 'sodium-project', icon_url: 'sodium.png' },
          ]
        : [],
    }))
    const getProjectVersions = vi.fn(async () => [{ id: 'sodium-version' }])

    const result = await resolveArtifactModrinthDependencies({
      url: 'https://example.test/iris.jar',
      loader: 'fabric',
      minecraft: '1.21.1',
      installedMods: [{ modId: 'fabric-api', provideRuntime: {} }],
      selectedProjects: new Set(['iris-project']),
      client: { searchProjects, getProjectVersions },
      fetchArtifact: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }),
      inspectArtifact: async () => ['minecraft', 'fabric-api', 'sodium'],
    })

    expect(result).toEqual([{ versionId: 'sodium-version', icon: 'sodium.png' }])
    expect(searchProjects).toHaveBeenCalledOnce()
    expect(getProjectVersions).toHaveBeenCalledWith('sodium-project', {
      gameVersions: ['1.21.1'],
      loaders: ['fabric'],
    })
  })

  test('ignores projects already selected from provider dependencies', async () => {
    const getProjectVersions = vi.fn()
    const result = await resolveArtifactModrinthDependencies({
      url: 'https://example.test/mod.jar',
      loader: 'neoforge',
      minecraft: '1.21.1',
      installedMods: [],
      selectedProjects: new Set(['sodium-project']),
      client: {
        searchProjects: async () => ({ hits: [{ slug: 'sodium', project_id: 'sodium-project' }] }),
        getProjectVersions,
      },
      fetchArtifact: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }),
      inspectArtifact: async () => ['sodium'],
    })

    expect(result).toEqual([])
    expect(getProjectVersions).not.toHaveBeenCalled()
  })
})