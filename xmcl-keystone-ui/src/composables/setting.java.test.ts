import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef, type ShallowRef } from 'vue'
import { Settings } from '@xmcl/runtime-api'

const h = vi.hoisted(() => ({ state: undefined as ShallowRef<Settings | undefined> | undefined }))
vi.mock('@/composables', () => ({ useService: () => ({ getSettings: vi.fn() }) }))
vi.mock('./syncableState', () => ({
  useState: () => ({ state: h.state }),
}))

import { useGlobalSettings, useSettingsState } from './setting'

describe('global Java settings', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('waits for the settings mutation and propagates its failure', async () => {
    vi.stubGlobal('computed', computed)
    const settings = new Settings()
    let reject!: (error: Error) => void
    const commit = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise
    })
    vi.spyOn(settings, 'globalJavaSetting').mockImplementation(() => commit)
    h.state = shallowRef(settings)
    const save = useGlobalSettings(useSettingsState()).setGlobalJavaSettings({
      globalMinMemory: 1,
      globalMaxMemory: 2,
      globalAssignMemory: true,
      globalJava: '/java',
      globalPreferredJavaVendor: 'default',
    })
    let settled = false
    void save.then(
      () => { settled = true },
      () => { settled = true },
    )
    await Promise.resolve()
    expect(settled).toBe(false)
    const failure = new Error('commit failed')
    reject(failure)
    await expect(save).rejects.toBe(failure)
  })
})
