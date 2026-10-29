import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import type { UpdateCapability } from '@xmcl/runtime-api'
import { useUpdateCapability } from './updateCapability'

const unavailable: UpdateCapability = { automatic: false, reason: 'not-implemented' }

describe('update capability presentation contract', () => {
  it('waits for async shared settings before deciding whether normal update UI applies', async () => {
    const state = shallowRef<{ updateCapability?: UpdateCapability }>()
    const check = vi.fn(async () => {})
    const ui = useUpdateCapability(state, check)
    expect(ui.updateStateReady.value).toBe(false)
    await ui.checkUpdate()
    expect(check).not.toHaveBeenCalled()
    state.value = { updateCapability: unavailable }
    expect(ui.updateStateReady.value).toBe(true)
    expect(ui.updateUnavailable.value).toBe(true)
    expect(ui.updateCapabilityReason.value).toBe('not-implemented')
    await ui.checkUpdate()
    expect(ui.manualCheckRequested.value).toBe(true)
    expect(ui.checkingUpdate.value).toBe(false)
    expect(check).not.toHaveBeenCalled()
  })

  it('preserves existing adapters without capability and resets busy after errors', async () => {
    const state = shallowRef({})
    const error = new Error('Network failed')
    const check = vi.fn(async () => { throw error })
    const ui = useUpdateCapability(state, check)
    expect(ui.updateStateReady.value).toBe(true)
    expect(ui.updateUnavailable.value).toBe(false)
    await expect(ui.checkUpdate()).rejects.toBe(error)
    expect(ui.checkingUpdate.value).toBe(false)
    expect(ui.manualCheckRequested.value).toBe(false)
    expect(check).toHaveBeenCalledOnce()
  })

  it('reacts to configured-capability mutations without navigating or invoking check', async () => {
    const state = shallowRef({ updateCapability: { automatic: false, reason: 'not-configured' } as UpdateCapability })
    const check = vi.fn(async () => {})
    const ui = useUpdateCapability(state, check)
    expect(ui.updateCapabilityReason.value).toBe('not-configured')
    await ui.checkUpdate()
    expect(ui.checkingUpdate.value).toBe(false)
    expect(check).not.toHaveBeenCalled()
    state.value = { updateCapability: unavailable }
    expect(ui.updateCapabilityReason.value).toBe('not-implemented')
  })
})
