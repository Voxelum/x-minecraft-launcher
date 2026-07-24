interface NamedAgentTool {
  name: string
}

type RuntimeAgentId = 'launcher' | 'css'

const EXPECTED_AGENT_TOOLS: Record<RuntimeAgentId, readonly string[]> = {
  launcher: ['vfs_list', 'vfs_read', 'vfs_rm', 'edit_config', 'edit_instance', 'bash'],
  css: ['get_custom_css', 'set_custom_css', 'set_custom_css_enabled'],
}

export function getExpectedRuntimeAgentToolNames(agentId: RuntimeAgentId, hasUi: boolean) {
  return hasUi ? [...EXPECTED_AGENT_TOOLS[agentId], 'ui'] : [...EXPECTED_AGENT_TOOLS[agentId]]
}

export function buildRuntimeAgentToolSet<T extends NamedAgentTool>(agentId: RuntimeAgentId, hasUi: boolean, tools: T[]) {
  const loaded = hasUi ? tools : tools.filter(tool => tool.name !== 'ui')
  const expectedNames = getExpectedRuntimeAgentToolNames(agentId, hasUi)
  const loadedNames = loaded.map(tool => tool.name)
  if (loadedNames.length !== expectedNames.length || loadedNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error(`Invalid ${agentId} Agent tool set: expected [${expectedNames.join(', ')}], loaded [${loadedNames.join(', ')}]`)
  }
  return loaded
}
