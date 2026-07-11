import { ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
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
    const model = getModrinthDependenciesModel(ref({
      id: 'root-version',
      project_id: 'root-project',
      dependencies: [{
        project_id: 'deleted-incompatible-project',
        version_id: null,
        dependency_type: 'incompatible',
      }],
      loaders: ['neoforge'],
      game_versions: ['1.21.1'],
    } as any), undefined, {} as any)

    await expect(model.fetcher()).resolves.toEqual([])
    expect(clientModrinthV2.getProject).not.toHaveBeenCalled()
    expect(clientModrinthV2.getProjectVersions).not.toHaveBeenCalled()
  })
})
