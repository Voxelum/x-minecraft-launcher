import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { SharedState } from '@xmcl/runtime-api'
import { useState } from './syncableState'

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn(),
}))
vi.stubGlobal('document', {})
vi.stubGlobal('window', {})

class TestState {
  value = ''
}

function createState(id: string): SharedState<TestState> {
  const state = new TestState()
  const shared = state as SharedState<TestState>
  Object.assign(shared, {
    id,
    subscribe: vi.fn(() => shared),
    unsubscribe: vi.fn(() => shared),
    subscribeAll: vi.fn(() => shared),
    unsubscribeAll: vi.fn(() => shared),
    revalidate: vi.fn(),
    unref: vi.fn(),
  })
  return shared
}

async function flushState() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

describe('useState', () => {
  it('releases the prior state when its fetcher dependency changes', async () => {
    const key = ref('first')
    const first = createState('first')
    const second = createState('second')

    useState(
      async () => key.value === 'first' ? first : second,
      TestState,
    )
    await flushState()

    key.value = 'second'
    await flushState()

    expect(first.unref).toHaveBeenCalledOnce()
    expect(second.unref).not.toHaveBeenCalled()
  })
})
