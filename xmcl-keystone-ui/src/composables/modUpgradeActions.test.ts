import { RuntimeVersionsSchema } from '@xmcl/instance'
import { createApp, ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import { useModUpgrade, type UpgradePlan } from './modUpgrade'
import { kSWRVConfig, useSWRVConfig } from './swrvConfig'

const { show } = vi.hoisted(() => ({ show: vi.fn() }))
vi.mock('@/util/basename', async () => ({ basename: (await import('node:path')).basename }))
vi.mock('./dialog', () => ({ useDialog: () => ({ show }) }))
vi.mock('./exception', () => ({ useErrorHandler: vi.fn() }))

let finishInstall: () => void
vi.mock('./instanceInstallOperation', () => ({
  useInstanceInstallOperation: (_path: unknown, onSucceed: () => void) => {
    finishInstall = onSucceed
    return { task: ref(undefined), id: ref('update-id'), begin: vi.fn(), reset: vi.fn() }
  },
}))

function plan(project: string): UpgradePlan {
  return {
    updating: false,
    filePath: `${project}-old.jar`,
    mod: { fileName: `${project}-old.jar`, hash: 'old', size: 12 } as UpgradePlan['mod'],
    version: {
      id: `${project}-version`,
      project_id: project,
      author_id: 'test-author',
      featured: false,
      name: `${project} 2.0`,
      version_number: '2.0',
      date_published: '2026-01-01T00:00:00Z',
      downloads: 0,
      version_type: 'release',
      dependencies: [],
      game_versions: ['1.21.1'],
      loaders: ['fabric'],
      files: [{
        filename: `${project}-new.jar`,
        primary: true,
        hashes: { sha1: 'new' },
        size: 12,
        url: `https://example.test/${project}-new.jar`,
      }],
    },
  }
}

describe('mod upgrade actions', () => {
  test('updates only the requested project and preserves the other pending update', () => {
    show.mockClear()
    const app = createApp({})
    app.provide(kSWRVConfig, useSWRVConfig())
    const { plans, upgradeOne } = app.runWithContext(() => useModUpgrade(
      ref('/test-instance'), ref(RuntimeVersionsSchema.parse({ minecraft: '1.21.1' })), ref([]), async () => {},
    ))
    const sodium = plan('sodium')
    const lithium = plan('lithium')
    plans.value = { sodium, lithium }

    upgradeOne('missing')
    expect(show).not.toHaveBeenCalled()

    upgradeOne('sodium')
    expect(show).toHaveBeenCalledExactlyOnceWith({
      type: 'updates',
      id: 'update-id',
      oldFiles: [expect.objectContaining({ path: 'mods/sodium-old.jar' })],
      files: [expect.objectContaining({ path: 'mods/sodium-new.jar' })],
    })

    finishInstall()
    expect(plans.value).toEqual({ lithium })
  })
})
