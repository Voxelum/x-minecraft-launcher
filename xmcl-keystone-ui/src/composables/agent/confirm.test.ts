import { describe, expect, test } from 'vitest'
import { clearAgentConfirmationScope, registerAgentConfirmationScope, requestAgentConfirmation, useAgentConfirmation } from './confirm'

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

  test('preserves marketplace presentations for manifest confirmation', async () => {
    const controls = useAgentConfirmation()
    const result = requestAgentConfirmation({
      action: 'confirm',
      message: 'apply manifest',
      presentations: [{
        type: 'market-project-list',
        source: 'modrinth',
        query: '',
        total: 1,
        items: [{
          provider: 'modrinth',
          projectType: 'mod',
          id: 'iris',
          title: 'Iris Shaders',
          description: 'Shader loader',
        }],
      }],
    })

    expect(controls.request.value?.presentations?.[0].items[0]).toMatchObject({ id: 'iris', title: 'Iris Shaders' })
    controls.accept()
    await expect(result).resolves.toBe(true)
  })

  test('allows subsequent non-destructive confirmations for the active run', async () => {
    const controls = useAgentConfirmation()
    registerAgentConfirmationScope('run-a')
    registerAgentConfirmationScope('run-b')
    const first = requestAgentConfirmation({ action: 'confirm', message: 'apply manifest', allowAll: true }, undefined, 'run-a')

    controls.allowAll()

    await expect(first).resolves.toBe(true)
    await expect(requestAgentConfirmation({ action: 'confirm', message: 'install loader' }, undefined, 'run-a')).resolves.toBe(true)
    expect(controls.shown.value).toBe(false)

    const otherRun = requestAgentConfirmation({ action: 'confirm', message: 'other run' }, undefined, 'run-b')
    expect(controls.request.value?.message).toBe('other run')
    controls.decline()
    await expect(otherRun).resolves.toBe(false)

    const destructive = requestAgentConfirmation({ action: 'confirm', message: 'delete instance', destructive: true }, undefined, 'run-a')
    expect(controls.request.value?.message).toBe('delete instance')
    controls.decline()
    await expect(destructive).resolves.toBe(false)

    clearAgentConfirmationScope('run-a')
    clearAgentConfirmationScope('run-b')
    const nextRun = requestAgentConfirmation({ action: 'confirm', message: 'next run' }, undefined, 'run-a')
    expect(controls.request.value?.message).toBe('next run')
    controls.decline()
    await expect(nextRun).resolves.toBe(false)
  })
})
