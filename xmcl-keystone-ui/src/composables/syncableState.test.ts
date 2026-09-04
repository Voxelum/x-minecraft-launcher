import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { SharedState } from '@xmcl/runtime-api'
import { useState } from './syncableState'

const documentTarget = new EventTarget()
const windowTarget = new EventTarget()
vi.stubGlobal('document', documentTarget)
vi.stubGlobal('window', windowTarget)

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
    const scope = effectScope()

    scope.run(() => {
      useState(
        async () => key.value === 'first' ? first : second,
        TestState,
      )
    })
    await flushState()

    key.value = 'second'
    await flushState()

    expect(first.unref).toHaveBeenCalledOnce()
    expect(second.unref).not.toHaveBeenCalled()
    scope.stop()
  })

  it('shares revalidation event listeners between states', async () => {
    const addDocumentListener = vi.spyOn(documentTarget, 'addEventListener')
    const removeDocumentListener = vi.spyOn(documentTarget, 'removeEventListener')
    const addWindowListener = vi.spyOn(windowTarget, 'addEventListener')
    const removeWindowListener = vi.spyOn(windowTarget, 'removeEventListener')
    const first = createState('first')
    const second = createState('second')
    const scope = effectScope()

    scope.run(() => {
      useState(async () => first, TestState)
      useState(async () => second, TestState)
    })
    await flushState()

    expect(addDocumentListener).toHaveBeenCalledTimes(1)
    expect(addWindowListener).toHaveBeenCalledTimes(1)

    windowTarget.dispatchEvent(new Event('focus'))
    await flushState()

    expect(first.revalidate).toHaveBeenCalledOnce()
    expect(second.revalidate).toHaveBeenCalledOnce()

    scope.stop()
    expect(removeDocumentListener).toHaveBeenCalledTimes(1)
    expect(removeWindowListener).toHaveBeenCalledTimes(1)
  })
})
