import { describe, expect, test, vi } from 'vitest'
import { applyInstanceLinkPreferences, InstanceLinkOperations } from './instanceCreation'

function createOperations(overrides: Partial<InstanceLinkOperations> = {}) {
  return {
    linkSaves: vi.fn().mockResolvedValue(undefined),
    linkResourcePacks: vi.fn().mockResolvedValue(undefined),
    linkShaderPacks: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('applyInstanceLinkPreferences', () => {
  test('applies no link when every preference is unchecked', async () => {
    const ops = createOperations()
    const failed = await applyInstanceLinkPreferences('/path', {
      saves: false,
      resourcepacks: false,
      shaderpacks: false,
    }, ops)

    expect(failed).toEqual([])
    expect(ops.linkSaves).not.toHaveBeenCalled()
    expect(ops.linkResourcePacks).not.toHaveBeenCalled()
    expect(ops.linkShaderPacks).not.toHaveBeenCalled()
  })

  test('links only the checked folders with the instance path', async () => {
    const ops = createOperations()
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: true,
      resourcepacks: false,
      shaderpacks: true,
    }, ops)

    expect(failed).toEqual([])
    expect(ops.linkSaves).toHaveBeenCalledWith('/instance')
    expect(ops.linkResourcePacks).not.toHaveBeenCalled()
    expect(ops.linkShaderPacks).toHaveBeenCalledWith('/instance')
  })

  test('reports the failed folder while still linking the others', async () => {
    const ops = createOperations({
      linkResourcePacks: vi.fn().mockRejectedValue(new Error('EPERM')),
    })
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: true,
      resourcepacks: true,
      shaderpacks: true,
    }, ops)

    expect(failed).toEqual(['resourcepacks'])
    expect(ops.linkSaves).toHaveBeenCalledWith('/instance')
    expect(ops.linkShaderPacks).toHaveBeenCalledWith('/instance')
  })

  test('aggregates multiple independent failures', async () => {
    const ops = createOperations({
      linkSaves: vi.fn().mockRejectedValue(new Error('locked')),
      linkShaderPacks: vi.fn().mockRejectedValue(new Error('locked')),
    })
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: true,
      resourcepacks: true,
      shaderpacks: true,
    }, ops)

    expect(failed).toEqual(['saves', 'shaderpacks'])
    expect(ops.linkResourcePacks).toHaveBeenCalledWith('/instance')
  })
})
