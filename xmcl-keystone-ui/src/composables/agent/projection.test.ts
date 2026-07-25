import { describe, expect, test } from 'vitest'
import { parseAgentToolPresentation, projectAgentTranscript } from './projection'

describe('agent run projection', () => {
  test('pairs tool results with their calls and removes standalone result rows', () => {
    const transcript = projectAgentTranscript([
      { role: 'user', content: 'search mods' },
      {
        role: 'assistant',
        content: null,
        toolCalls: [{ id: 'call-1', name: 'bash', arguments: { command: 'market curseforge search top' } }],
      },
      { role: 'tool', toolCallId: 'call-1', name: 'bash', content: '{"total":1}' },
      { role: 'assistant', content: 'Here are the results.' },
    ])

    expect(transcript.map(item => item.kind)).toEqual(['message', 'tool', 'message'])
    expect(transcript[1]).toMatchObject({
      kind: 'tool',
      call: { id: 'call-1', name: 'bash' },
      result: { toolCallId: 'call-1', content: '{"total":1}' },
    })
  })

  test('keeps assistant text when the same message also contains tool calls', () => {
    const transcript = projectAgentTranscript([{
      role: 'assistant',
      content: 'I will search.',
      toolCalls: [{ id: 'call-1', name: 'bash', arguments: {} }],
    }])

    expect(transcript.map(item => item.kind)).toEqual(['message', 'tool'])
  })

  test('parses a validated market presentation from a tool result', () => {
    const presentation = parseAgentToolPresentation({
      role: 'tool',
      content: JSON.stringify({
        presentation: {
          type: 'market-project-list',
          source: 'modrinth',
          query: 'performance',
          total: 1,
          items: [{
            provider: 'modrinth',
            id: 'abc',
            title: 'Sodium',
            description: 'Renderer optimization',
          }],
        },
      }),
    })

    expect(presentation).toMatchObject({
      type: 'market-project-list',
      source: 'modrinth',
      items: [{ id: 'abc', title: 'Sodium', projectType: 'mod' }],
    })
  })
})
