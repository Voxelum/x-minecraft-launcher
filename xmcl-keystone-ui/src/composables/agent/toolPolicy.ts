const AGENT_STAGED_INSTALL_COMMAND_IDS = new Set([
  'mod.install',
  'resourcepack.install',
  'shaderpack.install',
  'save.install',
])

export interface AgentStagedInstallResult {
  ok: true
  command: string
  staged: true
  count: number
  files: string[]
  instance: string
  message: string
  manifest?: { files: string[]; oldFiles: string[] }
  guidance?: string
}

export function isAgentCommandAllowed(commandId: string) {
  return isAgentStagedInstallCommand(commandId)
}

export function isAgentStagedInstallCommand(commandId: string) {
  return AGENT_STAGED_INSTALL_COMMAND_IDS.has(commandId)
}

export function createAgentStagedInstallPresenter() {
  let guidanceShown = false
  return (command: string, result: unknown, instance: string): AgentStagedInstallResult => {
    const details = result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : undefined
    const resultFiles = Array.isArray(result) ? result : details?.files
    const files = Array.isArray(resultFiles) ? resultFiles.filter((value): value is string => typeof value === 'string') : []
    const count = files.length
    const message = count === 0
      ? 'No files were staged.'
      : count === 1
        ? `${files[0]} has been staged.`
        : `${count} files have been staged: ${files.join(', ')}.`
    const response: AgentStagedInstallResult = {
      ok: true,
      command,
      staged: true,
      count,
      files,
      instance,
      message,
    }
    const manifest = details?.manifest
    if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
      const value = manifest as Record<string, unknown>
      response.manifest = {
        files: Array.isArray(value.files) ? value.files.filter((entry): entry is string => typeof entry === 'string') : [],
        oldFiles: Array.isArray(value.oldFiles) ? value.oldFiles.filter((entry): entry is string => typeof entry === 'string') : [],
      }
    }
    if (!guidanceShown) {
      response.guidance = 'Staging only records pending instance changes; no files are installed yet. You may stage more resources, then run `instance manifest status` to review all pending changes and `instance manifest apply` to apply them. Applying asks for user confirmation.'
      guidanceShown = true
    }
    return response
  }
}

export function buildAgentInstanceEdit(
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
  return { payload, edited }
}
