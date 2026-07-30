import { ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProjectVersion } from '@xmcl/modrinth'
import { clientModrinthV2 } from '@/util/clients'
import { getModrinthDependenciesModel } from './modrinthDependencies'

vi.mock('@/util/clients', () => ({
  clientModrinthV2: {
    getProject: vi.fn(),
    getProjectVersions: vi.fn(),
  },
}))

describe('getModrinthDependenciesModel', () => {
  beforeEach(() => {
    vi.mocked(clientModrinthV2.getProject).mockReset()
    vi.mocked(clientModrinthV2.getProjectVersions).mockReset()
  })

  test('does not resolve inaccessible incompatible projects', async () => {
    const version: ProjectVersion = {
      id: 'root-version',
      project_id: 'root-project',
      author_id: 'author',
      featured: false,
      name: 'Root version',
      version_number: '1.0.0',
      date_published: '2026-01-01T00:00:00Z',
      downloads: 0,
      version_type: 'release',
      files: [],
      dependencies: [{
        project_id: 'deleted-incompatible-project',
        version_id: null,
        dependency_type: 'incompatible',
      }],
      loaders: ['neoforge'],
      game_versions: ['1.21.1'],
    }
    const model = getModrinthDependenciesModel(ref(version), undefined, {
      cache: undefined,
      dedupingInterval: 0,
    })

    await expect(model.fetcher()).resolves.toEqual([])
    expect(clientModrinthV2.getProject).not.toHaveBeenCalled()
    expect(clientModrinthV2.getProjectVersions).not.toHaveBeenCalled()
  })
})
