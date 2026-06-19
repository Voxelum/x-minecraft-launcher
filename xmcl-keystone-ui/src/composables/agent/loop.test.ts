import { describe, test, expect, vi, beforeEach } from 'vitest'
import { runAgent } from './loop'
import { chat } from './llm'
import type { Tool } from './loop'

vi.mock('./llm', () => ({ chat: vi.fn() }))

const chatMock = vi.mocked(chat)

function fakeTool(name: string, execute = vi.fn().mockResolvedValue({ ok: true })): Tool {
  return { name, description: '', parameters: { type: 'object', properties: {} }, execute }
}

/** Script the model: one tool call on the first turn, then a plain answer. */
function scriptToolThenDone(toolName: string, args: Record<string, unknown> = {}) {
  chatMock
    .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'c1', name: toolName, arguments: args }] } as any)
    .mockResolvedValueOnce({ content: 'done', toolCalls: [] } as any)
}

beforeEach(() => {
  chatMock.mockReset()
})

describe('runAgent — preloadedPacks (cross-turn pack persistence)', () => {
  test('re-mounts a previously-loaded pack so its tools are callable', async () => {
    const exec = vi.fn().mockResolvedValue({ ok: true, eula: true })
    const load = vi.fn().mockResolvedValue([fakeTool('set_server_eula', exec)])
    const loadable = { server: { description: 'srv', load } }
    scriptToolThenDone('set_server_eula', { accepted: true })

    const events: any[] = []
    await runAgent([{ role: 'user', content: 'agree' }] as any, {
      apiKey: 'k', endpoint: 'e', model: 'm',
      tools: [],
      loadable,
      preloadedPacks: ['server'],
      onEvent: (e: any) => events.push(e),
    } as any)

    expect(load).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith({ accepted: true }, expect.anything())
    const toolResult = events.find((e) => e.type === 'tool_result')
    expect(toolResult.toolResult.isError).toBeFalsy()
    expect(toolResult.toolResult.result).not.toContain('unknown tool')
  })

  test('without preloadedPacks the same tool is unknown (guards the original bug)', async () => {
    const load = vi.fn()
    const loadable = { server: { description: 'srv', load } }
    scriptToolThenDone('set_server_eula', { accepted: true })

    const events: any[] = []
    await runAgent([{ role: 'user', content: 'agree' }] as any, {
      apiKey: 'k', endpoint: 'e', model: 'm',
      tools: [],
      loadable,
      onEvent: (e: any) => events.push(e),
    } as any)

    expect(load).not.toHaveBeenCalled()
    const toolResult = events.find((e) => e.type === 'tool_result')
    expect(toolResult.toolResult.isError).toBe(true)
    expect(toolResult.toolResult.result).toContain('unknown tool')
  })

  test('does not double-load a pack already present, and ignores unknown pack names', async () => {
    const load = vi.fn().mockResolvedValue([fakeTool('install_server')])
    const loadable = { server: { description: 'srv', load } }
    chatMock.mockResolvedValueOnce({ content: 'hi', toolCalls: [] } as any)

    await runAgent([{ role: 'user', content: 'x' }] as any, {
      apiKey: 'k', endpoint: 'e', model: 'm',
      tools: [],
      loadable,
      // 'server' twice + a bogus name — must load once, skip the bogus one
      preloadedPacks: ['server', 'server', 'does_not_exist'],
      onEvent: () => {},
    } as any)

    expect(load).toHaveBeenCalledTimes(1)
  })

  test('a pack that fails to re-mount does not crash the turn', async () => {
    const load = vi.fn().mockRejectedValue(new Error('boom'))
    const loadable = { server: { description: 'srv', load } }
    chatMock.mockResolvedValueOnce({ content: 'recovered', toolCalls: [] } as any)

    const events: any[] = []
    await runAgent([{ role: 'user', content: 'x' }] as any, {
      apiKey: 'k', endpoint: 'e', model: 'm',
      tools: [],
      loadable,
      preloadedPacks: ['server'],
      onEvent: (e: any) => events.push(e),
    } as any)

    // The loop still produced a normal assistant answer.
    expect(events.some((e) => e.type === 'done')).toBe(true)
  })
})
