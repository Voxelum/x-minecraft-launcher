import { describe, test, expect, vi, beforeEach } from 'vitest'
import { runAgent } from './loop'
import { chat } from './llm'

vi.mock('./llm', () => ({ chat: vi.fn() }))

const chatMock = vi.mocked(chat)

/** Script the model: one tool call on the first turn, then a plain answer. */
function scriptToolThenDone(toolName: string, args: Record<string, unknown> = {}) {
  chatMock
    .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'c1', name: toolName, arguments: args }] } as any)
    .mockResolvedValueOnce({ content: 'done', toolCalls: [] } as any)
}

beforeEach(() => {
  chatMock.mockReset()
})

describe('runAgent', () => {
  test('executes registered tools and completes', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true })
    scriptToolThenDone('example', { value: 1 })
    const events: any[] = []

    await runAgent([{ role: 'user', content: 'run it' }] as any, {
      apiKey: 'k', endpoint: 'e', model: 'm',
      tools: [{ name: 'example', description: '', parameters: { type: 'object', properties: {} }, execute }],
      onEvent: (event) => events.push(event),
    })

    expect(execute).toHaveBeenCalledWith({ value: 1 }, expect.any(AbortSignal))
    expect(events.some((event) => event.type === 'done')).toBe(true)
  })

  test('does not expose the removed load_tools meta-tool', async () => {
    chatMock.mockResolvedValueOnce({ content: 'done', toolCalls: [] } as any)
    await runAgent([{ role: 'user', content: 'hello' }] as any, {
      apiKey: 'k', endpoint: 'e', model: 'm', tools: [],
    })

    const definitions = chatMock.mock.calls[0][1]
    expect(definitions.map((tool: any) => tool.function.name)).not.toContain('load_tools')
  })
})
