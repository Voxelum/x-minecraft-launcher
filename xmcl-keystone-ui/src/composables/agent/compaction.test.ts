import { AGENT_MODEL_CONTEXT_WINDOW, type AgentMessage } from '@xmcl/runtime-api'
import { describe, expect, it } from 'vitest'
import { compactedMessages, estimateAgentContextTokens, prepareAgentCompaction } from './compaction'
import { AGENT_COMPACTION_MESSAGE_NAME, fromPiMessage, toPiMessage } from './protocol'
import { AGENT_PASSIVE_CONTEXT_MESSAGE_NAME } from './context'

const provider = 'xmcl'
const model = 'xmcl-agent'

function turn(id: string, size: number): AgentMessage[] {
  return [
    { role: 'user', content: `request-${id}` },
    {
      role: 'assistant',
      content: null,
      toolCalls: [{ id: `call-${id}`, name: 'vfs_shell', arguments: { command: id } }],
    },
    { role: 'tool', toolCallId: `call-${id}`, name: 'vfs_shell', content: id.repeat(size) },
    { role: 'assistant', content: `result-${id}` },
  ]
}

describe('agent context compaction', () => {
  it('does not compact at or below the 256K working target', () => {
    expect(prepareAgentCompaction(turn('a', 1_000), 200_000, provider, model)).toBeUndefined()
    expect(prepareAgentCompaction(turn('a', 1_000), AGENT_MODEL_CONTEXT_WINDOW, provider, model)).toBeUndefined()
  })

  it('retains about 20K tokens starting at a complete user turn', () => {
    const messages = [
      ...turn('old', 900_000),
      ...turn('recent', 90_000),
    ]
    const preparation = prepareAgentCompaction(messages, AGENT_MODEL_CONTEXT_WINDOW + 1, provider, model)

    expect(preparation).toBeDefined()
    expect(preparation?.messagesToSummarize).toEqual(turn('old', 900_000))
    expect(preparation?.retainedMessages[0]).toEqual({ role: 'user', content: 'request-recent' })
    expect(preparation?.retainedMessages.some(message => message.role === 'tool')).toBe(true)
  })

  it('stores a hidden checkpoint that is restored as model context', () => {
    const preparation = prepareAgentCompaction(
      [...turn('old', 900_000), ...turn('recent', 90_000)],
      AGENT_MODEL_CONTEXT_WINDOW + 1,
      provider,
      model,
    )!
    const [checkpoint] = compactedMessages(preparation, 'Summary text')
    const modelMessage = toPiMessage(checkpoint, provider, model)

    expect(checkpoint).toMatchObject({
      role: 'system',
      name: AGENT_COMPACTION_MESSAGE_NAME,
      compaction: { tokensBefore: AGENT_MODEL_CONTEXT_WINDOW + 1 },
    })
    expect(modelMessage).toMatchObject({ role: 'user' })
    expect(JSON.stringify(modelMessage)).toContain('Summary text')
  })

  it('restores hidden passive events as model context', () => {
    const modelMessage = toPiMessage({
      role: 'system',
      name: AGENT_PASSIVE_CONTEXT_MESSAGE_NAME,
      content: 'Current launcher page: /mods',
    }, provider, model)

    expect(modelMessage).toMatchObject({ role: 'user' })
    expect(JSON.stringify(modelMessage)).toContain('xmcl-passive-context')
    expect(JSON.stringify(modelMessage)).toContain('/mods')
  })

  it('uses the latest provider context usage plus trailing messages', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'ignored old content'.repeat(10_000) },
      { role: 'assistant', content: 'answer', contextTokens: 250_000 },
      { role: 'user', content: 'x'.repeat(4_000) },
    ]

    expect(estimateAgentContextTokens(messages, 'ignored system prompt', 'y'.repeat(4_000), provider, model)).toBe(252_000)
  })

  it('preserves reasoning content across provider and persisted messages', () => {
    const persisted = fromPiMessage({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Inspect the loader.' },
        { type: 'text', text: 'I found the issue.' },
      ],
      api: 'openai-completions',
      provider,
      model,
      usage: {
        input: 1,
        output: 2,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 3,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'stop',
      timestamp: Date.now(),
    })

    expect(persisted).toMatchObject({
      role: 'assistant',
      content: 'I found the issue.',
      reasoningContent: 'Inspect the loader.',
    })
    expect(toPiMessage(persisted!, provider, model)).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Inspect the loader.' },
        { type: 'text', text: 'I found the issue.' },
      ],
    })
  })
})