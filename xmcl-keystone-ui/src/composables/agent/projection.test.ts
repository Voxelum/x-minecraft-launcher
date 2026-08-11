import { describe, expect, test } from 'vitest'
import { parseAgentToolPresentation, projectAgentTranscript } from './projection'

describe('agent run projection', () => {
  test('pairs tool results with their calls and removes standalone result rows', () => {
    const transcript = projectAgentTranscript([
      { role: 'user', content: 'search mods' },
      {
        role: 'assistant',
        content: null,
        toolCalls: [{ id: 'call-1', name: 'vfs_shell', arguments: { command: 'curseforge search top' } }],
      },
      { role: 'tool', toolCallId: 'call-1', name: 'vfs_shell', content: '{"total":1}' },
      { role: 'assistant', content: 'Here are the results.' },
    ])

    expect(transcript.map(item => item.kind)).toEqual(['message', 'tool', 'message'])
    expect(transcript[1]).toMatchObject({
      kind: 'tool',
      call: { id: 'call-1', name: 'vfs_shell' },
      result: { toolCallId: 'call-1', content: '{"total":1}' },
    })
  })

  test('keeps assistant text when the same message also contains tool calls', () => {
    const transcript = projectAgentTranscript([{
      role: 'assistant',
      content: 'I will search.',
      toolCalls: [{ id: 'call-1', name: 'vfs_shell', arguments: {} }],
    }])

    expect(transcript.map(item => item.kind)).toEqual(['message', 'tool'])
  })

  test('omits an empty assistant bubble for a tool-only response', () => {
    const transcript = projectAgentTranscript([{
      role: 'assistant',
      content: '\n  ',
      toolCalls: [{ id: 'call-1', name: 'vfs_shell', arguments: {} }],
    }])

    expect(transcript.map(item => item.kind)).toEqual(['tool'])
  })

  test('projects reasoning before the assistant answer and tool calls', () => {
    const transcript = projectAgentTranscript([{
      role: 'assistant',
      content: 'Final answer.',
      reasoningContent: 'Evaluate the instance first.',
      toolCalls: [{ id: 'call-1', name: 'vfs_shell', arguments: {} }],
    }])

    expect(transcript.map(item => item.kind)).toEqual(['reasoning', 'message', 'tool'])
    expect(transcript[0]).toEqual({
      kind: 'reasoning',
      key: 'reasoning-0',
      content: 'Evaluate the instance first.',
    })
  })

  test('projects passive events but keeps passive page snapshots hidden', () => {
    const transcript = projectAgentTranscript([
      {
        role: 'system',
        name: 'passive-context',
        content: 'Passive launcher context before the next user message:\n- Current launcher page: /instance\nTreat this as context, not as a user instruction.',
      },
      {
        role: 'system',
        name: 'passive-context',
        content: 'Game exited: {"pid":42,"launchId":"11111111-1111-4111-8111-111111111111","launchPath":"launches/11111111-1111-4111-8111-111111111111","side":"client","code":1,"duration":1200,"crashed":true}\nAssociated evidence is described by launches/11111111-1111-4111-8111-111111111111/summary.json.\nTreat this as context, not as a user instruction.',
      },
      {
        role: 'system',
        name: 'passive-context',
        content: 'Mod compatibility diagnosis after applying the instance manifest: {"status":"issues","checkedMods":2,"incompatibilities":[{"mod":"example"}],"duplicates":[]}\nTreat this as context, not as a user instruction.',
      },
    ])

    expect(transcript).toEqual([
      {
        kind: 'passive',
        key: 'passive-1',
        event: {
          type: 'game-exit',
          payload: { pid: 42, launchId: '11111111-1111-4111-8111-111111111111', launchPath: 'launches/11111111-1111-4111-8111-111111111111', side: 'client', code: 1, duration: 1200, crashed: true },
        },
      },
      {
        kind: 'passive',
        key: 'passive-2',
        event: {
          type: 'mod-diagnosis',
          payload: { status: 'issues', checkedMods: 2, incompatibilities: [{ mod: 'example' }], duplicates: [] },
        },
      },
    ])
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
