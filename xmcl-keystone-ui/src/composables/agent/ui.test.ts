import { ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import { createAgentUiHandler } from './ui'

function handler(instances: Array<{ path: string; name: string }>) {
  const selectedInstance = ref('')
  return {
    selectedInstance,
    handle: createAgentUiHandler({
      router: { push: vi.fn() } as any,
      selectedInstance,
      instances: ref(instances),
      selectAccount: vi.fn(),
    }),
  }
}

describe('Agent UI handler', () => {
  test('resolves a unique instance name to its canonical path', async () => {
    const { handle, selectedInstance } = handler([{ path: '/instances/Minecraft', name: 'Minecraft' }])
    await expect(handle({ action: 'select_instance', path: 'Minecraft' })).resolves.toEqual({
      ok: true,
      path: '/instances/Minecraft',
    })
    expect(selectedInstance.value).toBe('/instances/Minecraft')
  })

  test('rejects an unknown instance without changing selection', async () => {
    const { handle, selectedInstance } = handler([{ path: '/instances/Minecraft', name: 'Minecraft' }])
    await expect(handle({ action: 'select_instance', path: 'missing' })).rejects.toThrow('Unknown instance')
    expect(selectedInstance.value).toBe('')
  })

  test('delegates confirmation to the async UI handler', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    const selectedInstance = ref('')
    const handle = createAgentUiHandler({
      router: { push: vi.fn() } as any,
      selectedInstance,
      instances: ref([]),
      selectAccount: vi.fn(),
      confirm,
    })
    const controller = new AbortController()

    await expect(handle({
      action: 'confirm',
      title: 'Install mod',
      message: 'Install Sodium?',
    }, controller.signal)).resolves.toBe(true)
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Install mod' }), controller.signal)
  })

  // The wire schema is a flat object with every field optional (so strict
  // providers accept it), so the handler is the only thing enforcing that a
  // given action actually got the fields it needs.
  test('rejects an action that is missing its required field', async () => {
    const { handle } = handler([])
    await expect(handle({ action: 'navigate' } as any)).rejects.toThrow('"path" is required')
    await expect(handle({ action: 'query_dom' } as any)).rejects.toThrow('"selector" is required')
    await expect(handle({ action: 'get_computed_style' } as any)).rejects.toThrow('"selector" is required')
    await expect(handle({ action: 'select_account' } as any)).rejects.toThrow('"id" is required')
  })

  test('treats a blank required field as missing', async () => {
    const { handle } = handler([])
    await expect(handle({ action: 'navigate', path: '   ' })).rejects.toThrow('"path" is required')
  })

  test('rejects an unknown action instead of silently outlining the DOM', async () => {
    const { handle } = handler([])
    await expect(handle({ action: 'drop_database' } as any)).rejects.toThrow('Unknown ui action')
  })
})
