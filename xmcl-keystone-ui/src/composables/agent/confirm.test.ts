import { describe, expect, test } from 'vitest'
import { requestAgentConfirmation, useAgentConfirmation } from './confirm'

describe('agent confirmation queue', () => {
  test('serializes confirmation requests and resolves user choices', async () => {
    const controls = useAgentConfirmation()
    const first = requestAgentConfirmation({ action: 'confirm', message: 'first' })
    const second = requestAgentConfirmation({ action: 'confirm', message: 'second' })

    expect(controls.request.value?.message).toBe('first')
    controls.decline()
    await expect(first).resolves.toBe(false)
    expect(controls.request.value?.message).toBe('second')

    controls.accept()
    await expect(second).resolves.toBe(true)
    expect(controls.shown.value).toBe(false)
  })

  test('declines an active request when its tool call is aborted', async () => {
    const controls = useAgentConfirmation()
    const controller = new AbortController()
    const result = requestAgentConfirmation({
      action: 'confirm',
      message: 'install mod',
    }, controller.signal)

    controller.abort()

    await expect(result).resolves.toBe(false)
    expect(controls.shown.value).toBe(false)
  })
})
