import { describe, expect, test } from 'vitest'
import { buildAgentInstanceEdit, isAgentCommandAllowed } from './toolPolicy'

describe('agent command policy', () => {
  test('does not expose account removal', () => {
    expect(isAgentCommandAllowed('user.logout')).toBe(false)
    expect(isAgentCommandAllowed('instance.launch')).toBe(false)
    expect(isAgentCommandAllowed('mod.install')).toBe(true)
  })
})

describe('buildAgentInstanceEdit', () => {
  test('allowlists fields and merges runtime while resetting version', () => {
    const result = buildAgentInstanceEdit({
      runtime: {
        minecraft: '1.20.1',
        forge: '47.3.0',
        neoForged: '',
        fabricLoader: '',
        quiltLoader: '',
        optifine: '',
        labyMod: '',
      },
    }, '/instance', {
      maxMemory: 4096,
      author: 'must-not-change',
      runtime: { forge: '', fabricLoader: '0.16.0' },
    })

    expect(result).toEqual({
      payload: {
        instancePath: '/instance',
        maxMemory: 4096,
        runtime: {
          minecraft: '1.20.1',
          forge: '',
          neoForged: '',
          fabricLoader: '0.16.0',
          quiltLoader: '',
          optifine: '',
          labyMod: '',
        },
        version: '',
      },
      edited: ['maxMemory', 'runtime'],
    })
  })
})
