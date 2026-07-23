import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { createPackUpdateOperations, type PackKind } from './packs'

function setup(kind: PackKind) {
  const refresh = vi.fn().mockResolvedValue(undefined)
  const plans = ref({
    project: {
      mod: {
        name: kind === 'resourcepacks' ? 'Faithful' : '',
        fileName: 'old.zip',
        version: '1.0',
        hash: 'old-sha1',
        size: 10,
      },
      version: {
        id: 'version-2',
        project_id: 'project',
        version_number: '2.0',
        name: 'Version 2',
        files: [{ filename: 'new.zip', primary: true, hashes: { sha1: 'new-sha1' } }],
      },
      updating: false,
      filePath: 'old.zip',
    },
  })
  const add = vi.fn().mockResolvedValue({ added: true })
  const operations = createPackUpdateOperations({
    kind,
    currentInstancePath: () => '/instance',
    upgrade: {
      refresh,
      plans: plans as any,
      error: ref(undefined) as any,
      skipVersion: ref(false),
      upgradePolicy: ref('modrinth'),
    },
    instanceChanges: {
      add,
      status: vi.fn(),
      apply: vi.fn(),
      reset: vi.fn(),
    },
  })
  return { operations, refresh, add }
}

describe.each<PackKind>(['resourcepacks', 'shaderpacks'])('%s update operations', (kind) => {
  test('checks updates and adds replacements to the shared change list', async () => {
    const { operations, refresh, add } = setup(kind)
    const result = await operations.check({ policy: 'modrinthOnly', skipVersion: true })

    expect(refresh).toHaveBeenCalledWith({ policy: 'modrinthOnly', skipVersion: true })
    expect(add).toHaveBeenCalledWith({
      label: `${kind} updates`,
      oldFiles: [{ path: `${kind}/old.zip`, hashes: { sha1: 'old-sha1' }, size: 10 }],
      files: [expect.objectContaining({ path: `${kind}/new.zip`, hashes: { sha1: 'new-sha1' } })],
    })
    expect(result).toMatchObject({
      updates: [{ file: kind === 'resourcepacks' ? 'Faithful' : 'old.zip', from: '1.0', to: '2.0', source: 'modrinth' }],
      change: { added: true },
    })
  })
})
