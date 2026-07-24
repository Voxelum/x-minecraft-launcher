import { describe, expect, test } from 'vitest'
import { convertLegacyAgentMessage } from './migration'

describe('convertLegacyAgentMessage', () => {
  test('converts legacy assistant tool calls', () => {
    expect(convertLegacyAgentMessage({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call-1',
        type: 'function',
        function: { name: 'bash', arguments: '{"command":"help"}' },
      }],
    })).toEqual({
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'call-1', name: 'bash', arguments: { command: 'help' } }],
      toolCallId: undefined,
      name: undefined,
      isError: undefined,
    })
  })

  test('converts legacy tool result ids', () => {
    expect(convertLegacyAgentMessage({
      role: 'tool',
      tool_call_id: 'call-1',
      name: 'bash',
      content: 'ok',
    })).toMatchObject({
      role: 'tool',
      toolCallId: 'call-1',
      name: 'bash',
      content: 'ok',
    })
  })
})
