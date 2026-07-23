import { describe, expect, test } from 'vitest'
import { buildAgentSystemPrompt } from './prompt'

describe('buildAgentSystemPrompt', () => {
  test('only documents capabilities actually granted', () => {
    const prompt = buildAgentSystemPrompt({
      role: 'launcher-main',
      locale: 'en',
      tools: [{ name: 'vfs_read', readonly: true }],
      policy: { hasUi: false, readonly: true, canDelegate: false, depth: 0, maxDepth: 0 },
    })
    expect(prompt).toContain('vfs_read')
    expect(prompt).toContain('No UI capability is available')
    expect(prompt).not.toContain('Use `bash help`')
  })

  test('keeps the reserved subagent profile UI-less', () => {
    const prompt = buildAgentSystemPrompt({
      role: 'subagent',
      locale: 'en',
      tools: [{ name: 'vfs_read', readonly: true }],
      policy: { hasUi: false, readonly: true, canDelegate: false, depth: 1, maxDepth: 1 },
      taskContext: 'Inspect the latest crash report.',
    })
    expect(prompt).toContain('internal XMCL subagent')
    expect(prompt).toContain('Do not delegate')
    expect(prompt).toContain('report the exact blocked action to the parent')
  })
})
