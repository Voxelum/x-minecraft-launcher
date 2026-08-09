import { describe, expect, test } from 'vitest'
import { AGENT_PASSIVE_CONTEXT_MESSAGE_NAME, createAgentPassiveContextMessage, formatAgentRuntime, readAgentSessionContext, resolveAgentSessionSystemPrompt } from './context'

describe('Agent session context', () => {
  test('formats only enabled runtime versions', () => {
    expect(formatAgentRuntime({
      minecraft: '26.1.2',
      forge: '',
      neoForged: '26.1.2.10-beta',
      fabricLoader: '',
      optifine: undefined,
    })).toBe('Runtime:\n- Minecraft: 26.1.2\n- NeoForge: 26.1.2.10-beta')
  })

  test('keeps the session system prompt stable until compaction', () => {
    expect(resolveAgentSessionSystemPrompt('frozen', 'changed', false)).toBe('frozen')
    expect(resolveAgentSessionSystemPrompt('frozen', 'changed', true)).toBe('changed')
    expect(resolveAgentSessionSystemPrompt(undefined, 'initial', false)).toBe('initial')
  })

  test('refreshes a frozen prompt after the virtual shell tool rename', () => {
    const stored = 'The `bash` tool is a virtual XMCL command runner'
    const generated = 'The `vfs_shell` tool is a virtual XMCL command runner'
    expect(resolveAgentSessionSystemPrompt(stored, generated, false)).toBe(generated)
  })

  test('reads only supported session metadata', () => {
    expect(readAgentSessionContext({
      systemPrompt: 'frozen',
      passiveContext: { userId: 'user-1', page: '/mods', ignored: true },
    })).toEqual({
      systemPrompt: 'frozen',
      passiveContext: { userId: 'user-1', page: '/mods' },
    })
  })

  test('includes the current page before every user message when available', () => {
    expect(createAgentPassiveContextMessage(undefined, { userId: 'user-1', page: '/mods' })).toMatchObject({
      role: 'system',
      name: AGENT_PASSIVE_CONTEXT_MESSAGE_NAME,
      content: expect.stringContaining('Current launcher page: /mods'),
    })
    expect(createAgentPassiveContextMessage(
      { userId: 'user-1', page: '/mods' },
      { userId: 'user-1', page: '/mods' },
    )).toMatchObject({
      role: 'system',
      name: AGENT_PASSIVE_CONTEXT_MESSAGE_NAME,
      content: expect.stringContaining('Current launcher page: /mods'),
    })
    expect(createAgentPassiveContextMessage(
      { userId: 'user-1', page: '/mods' },
      { userId: 'user-2', page: '/shaderpacks' },
    )).toMatchObject({
      role: 'system',
      name: AGENT_PASSIVE_CONTEXT_MESSAGE_NAME,
      content: expect.stringContaining('Current launcher page: /shaderpacks'),
    })
    expect(createAgentPassiveContextMessage(
      { userId: 'user-1' },
      { userId: 'user-1' },
    )).toBeUndefined()
  })
})