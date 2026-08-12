import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createMultiplayerEntryController } from './multiplayerEntry'

describe('multiplayer entry', () => {
  it('opens the multiplayer window immediately for an XMCL account', () => {
    const account = ref({ accountId: 'account' })
    const shown = ref(false)
    const openWindow = vi.fn()
    const controller = createMultiplayerEntryController(
      account,
      shown,
      () => {
        shown.value = true
      },
      () => {
        shown.value = false
      },
      openWindow,
    )

    controller.request()

    expect(openWindow).toHaveBeenCalledOnce()
    expect(shown.value).toBe(false)
    controller.dispose()
  })

  it('waits for XMCL login before opening the multiplayer window', async () => {
    const account = ref<{ accountId: string }>()
    const shown = ref(false)
    const openWindow = vi.fn()
    const controller = createMultiplayerEntryController(
      account,
      shown,
      () => {
        shown.value = true
      },
      () => {
        shown.value = false
      },
      openWindow,
    )

    controller.request()
    expect(shown.value).toBe(true)
    expect(openWindow).not.toHaveBeenCalled()

    account.value = { accountId: 'account' }
    await nextTick()

    expect(shown.value).toBe(false)
    expect(openWindow).toHaveBeenCalledOnce()
    controller.dispose()
  })

  it('does nothing after the login dialog is dismissed', async () => {
    const account = ref<{ accountId: string }>()
    const shown = ref(false)
    const openWindow = vi.fn()
    const controller = createMultiplayerEntryController(
      account,
      shown,
      () => {
        shown.value = true
      },
      () => {
        shown.value = false
      },
      openWindow,
    )

    controller.request()
    await nextTick()
    shown.value = false
    await nextTick()
    account.value = { accountId: 'account' }
    await nextTick()

    expect(openWindow).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('restores the login dialog after a delegated login is cancelled', async () => {
    const account = ref<{ accountId: string }>()
    const shown = ref(false)
    const openWindow = vi.fn()
    const login = Promise.withResolvers<void>()
    const controller = createMultiplayerEntryController(
      account,
      shown,
      () => {
        shown.value = true
      },
      () => {
        shown.value = false
      },
      openWindow,
    )

    controller.request()
    await nextTick()
    const handoff = controller.handoff(() => login.promise)
    await nextTick()

    expect(shown.value).toBe(false)
    login.resolve()
    await handoff

    expect(shown.value).toBe(true)
    expect(openWindow).not.toHaveBeenCalled()
    controller.dispose()
  })
})