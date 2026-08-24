import type { ProjectVersion } from '@xmcl/modrinth'
import { describe, expect, test } from 'vitest'
import { includeModrinthUpgradeVersion } from './modrinthProjectVersions'

function createVersion(id: string): ProjectVersion {
  return {
    id,
    project_id: 'project',
    author_id: 'author',
    featured: false,
    name: id,
    version_number: id,
    date_published: '2026-01-01T00:00:00Z',
    downloads: 0,
    version_type: 'release',
    files: [],
    dependencies: [],
    loaders: ['neoforge'],
    game_versions: ['1.21.1'],
  }
}

describe('includeModrinthUpgradeVersion', () => {
  test('adds an upgrade omitted from the fetched project versions', () => {
    const installed = createVersion('installed')
    const upgrade = createVersion('upgrade')

    expect(includeModrinthUpgradeVersion([installed], upgrade)).toEqual([upgrade, installed])
  })

  test('does not duplicate an upgrade already returned by the project versions API', () => {
    const upgrade = createVersion('upgrade')

    expect(includeModrinthUpgradeVersion([upgrade], upgrade)).toEqual([upgrade])
  })
})