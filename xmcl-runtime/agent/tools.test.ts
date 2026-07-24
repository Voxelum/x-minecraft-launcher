import { describe, expect, test } from 'vitest'
import { buildRuntimeAgentToolSet, getExpectedRuntimeAgentToolNames } from './capabilities'

describe('runtime agent tools', () => {
  const launcherTools = [
    { name: 'vfs_list' },
    { name: 'vfs_read' },
    { name: 'vfs_rm' },
    { name: 'edit_config' },
    { name: 'edit_instance' },
    { name: 'bash' },
    { name: 'ui' },
  ]
  const cssTools = [
    { name: 'get_custom_css' },
    { name: 'set_custom_css' },
    { name: 'set_custom_css_enabled' },
    { name: 'ui' },
  ]

  test.each([
    ['launcher', true, launcherTools, 7],
    ['launcher', false, launcherTools, 6],
    ['css', true, cssTools, 4],
    ['css', false, cssTools, 3],
  ] as const)('loads the expected %s tool set when hasUi=%s', (agentId, hasUi, candidates, count) => {
    const loaded = buildRuntimeAgentToolSet(agentId, hasUi, [...candidates])
    expect(loaded).toHaveLength(count)
    expect(loaded.map(tool => tool.name)).toEqual(getExpectedRuntimeAgentToolNames(agentId, hasUi))
  })

  test('rejects a loaded tool set that drifts from the runtime contract', () => {
    expect(() => buildRuntimeAgentToolSet('launcher', true, launcherTools.filter(tool => tool.name !== 'bash')))
      .toThrow('Invalid launcher Agent tool set')
  })
})
