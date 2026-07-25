const AGENT_COMMAND_IDS = new Set([
  'mod.install',
  'resourcepack.install',
  'shaderpack.install',
  'save.install',
])

export function isAgentCommandAllowed(commandId: string) {
  return AGENT_COMMAND_IDS.has(commandId)
}

export function buildAgentInstanceEdit(
  instance: { runtime: Record<string, unknown> },
  instancePath: string,
  args: Record<string, unknown>,
) {
  const editable = [
    'name', 'description', 'java', 'minMemory', 'maxMemory', 'assignMemory',
    'vmOptions', 'mcOptions', 'env', 'resolution', 'fastLaunch', 'showLog',
    'hideLauncher', 'prependCommand', 'preExecuteCommand',
  ] as const
  const payload: Record<string, unknown> = { instancePath }
  const edited: string[] = []
  for (const key of editable) {
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      payload[key] = args[key]
      edited.push(key)
    }
  }
  if (args.runtime && typeof args.runtime === 'object') {
    payload.runtime = { ...instance.runtime, ...args.runtime }
    payload.version = ''
    edited.push('runtime')
  }
  return { payload, edited }
}
