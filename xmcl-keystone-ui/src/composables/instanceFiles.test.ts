import { computed, effectScope, ref, shallowRef, watch } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInstanceFiles } from './instanceFiles'

const mocks = vi.hoisted(() => ({
  show: vi.fn(),
  resume: vi.fn(),
}))
vi.mock('./dialog', () => ({ useDialog: () => ({ show: mocks.show }) }))
vi.mock('./service', () => ({ useService: () => ({
  watchInstanceInstall: vi.fn(),
  resumeInstanceInstall: mocks.resume,
}) }))
vi.mock('./syncableState', () => ({ useState: () => ({
  error: ref(), isValidating: ref(false), state: ref(),
}) }))
vi.mock('@/rendererAction', () => ({ runRendererAction: async (_parent: unknown, _name: string, run: (action: unknown) => Promise<void>) =>
  run({ run: (operation: () => Promise<unknown>) => operation(), fail: vi.fn() }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('instance checksum recovery', () => {
  it('opens the lazy recovery dialog from the always-mounted installer state', async () => {
    for (const [key, value] of Object.entries({ computed, ref, shallowRef, watch })) vi.stubGlobal(key, value)
    const error = {
      name: 'ChecksumNotMatchError',
      file: { path: 'mods/a.jar', hashes: { sha512: 'expected' } },
      expect: 'expected',
      actual: 'actual',
    }
    mocks.resume.mockResolvedValue([error])
    const scope = effectScope()
    try {
      const files = scope.run(() => useInstanceFiles(ref('instance')))!
      await files.resumeInstall('instance')
      expect(mocks.show).toHaveBeenCalledOnce()
      expect(files.blockingFiles.value).toEqual([{ file: error.file, expect: 'expected', actual: 'actual' }])
    } finally {
      scope.stop()
    }
  })
})
