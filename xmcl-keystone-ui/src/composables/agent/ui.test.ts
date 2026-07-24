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
})
