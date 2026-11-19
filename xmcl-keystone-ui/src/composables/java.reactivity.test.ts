import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, shallowRef, triggerRef, watch, type ShallowRef } from 'vue'
import { JavaState, type JavaRecord } from '@xmcl/runtime-api'

const h = vi.hoisted(() => ({ state: undefined as ShallowRef<JavaState> | undefined }))
vi.mock('@/composables', () => ({
  useService: () => ({}),
  useRefreshable: () => ({}),
}))
vi.mock('./syncableState', () => ({
  useState: (_fetcher: unknown, Type: typeof JavaState) => {
    h.state = shallowRef(new Type())
    return { state: h.state, isValidating: ref(false), error: ref(undefined) }
  },
}))
vi.mock('@/constant', () => ({ BuiltinImages: {} }))

import { useJavaContext } from './java'

describe('Java selection reactivity', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not re-notify Java watchers for an unchanged resolution', async () => {
    vi.stubGlobal('computed', computed)
    const java: JavaRecord = {
      path: '/jre/old/bin/java',
      version: '17',
      majorVersion: 17,
      valid: true,
    }
    const context = useJavaContext()
    const state = h.state!
    state.value.javaUpdate(java)
    triggerRef(state)
    const changed = vi.fn()
    const stop = watch(context.all, changed)

    state.value.javaUpdate({ ...java })
    triggerRef(state)
    await nextTick()
    expect(changed).not.toHaveBeenCalled()

    state.value.javaUpdate({ ...java, version: '17.0.1' })
    triggerRef(state)
    await nextTick()
    expect(changed).toHaveBeenCalledOnce()
    stop()
  })
})
