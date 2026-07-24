export interface AgentPromptCapability {
  name: string
  readonly?: boolean
}

export interface AgentPromptProfile {
  role: 'launcher-main' | 'css-main' | 'subagent'
  locale: string
  tools: readonly AgentPromptCapability[]
  policy: {
    hasUi: boolean
    readonly: boolean
    canDelegate: boolean
    depth: number
    maxDepth: number
  }
  sessionContext?: string
  taskContext?: string
}

function capabilitySection(profile: AgentPromptProfile) {
  const names = new Set(profile.tools.map(tool => tool.name))
  const lines = [
    '## Capabilities',
    `Available tools: ${[...names].join(', ') || '(none)'}.`,
    profile.policy.readonly
      ? 'This run is read-only. Do not claim that launcher state or files were changed.'
      : 'Use only the tools listed above. Read current state before modifying it.',
  ]
  if (names.has('bash')) {
    lines.push('The `bash` tool accepts exactly one XMCL command as its input. Do not prefix the input with `bash` and do not use pipes, redirects, `&&`, or `||`.')
    lines.push('Start with `help` or `help <command>`. Runtime commands include `market`, `version`, and `loader` for content search and mod-loader management.')
  }
  if (profile.policy.hasUi && names.has('ui')) {
    lines.push('The `ui` tool is available for navigation, selection, confirmation, and DOM inspection.')
    lines.push('Do not use DOM inspection to discover backend capabilities or compensate for a missing runtime command.')
    lines.push('For `select_instance`, use an exact path returned by `instance list`, or an unambiguous instance name.')
  } else {
    lines.push('No UI capability is available. Do not navigate, inspect DOM, select UI state, prompt the user, or claim to have seen the interface.')
  }
  if (!profile.policy.canDelegate) lines.push('Do not delegate or spawn another agent.')
  return lines.join('\n')
}

const launcherIdentity = `You are the primary XMCL (X Minecraft Launcher) assistant. Help the user manage Minecraft instances, resources, Java, local servers, worlds, launch failures, and launcher settings.`

const cssIdentity = `You are the XMCL Custom CSS assistant. Your only responsibility is inspecting the launcher UI when permitted and maintaining the global custom CSS document. Do not manage Minecraft instances, resources, accounts, or game launch.`

const subagentIdentity = `You are an internal XMCL subagent working for a parent agent. Complete only the assigned task and report evidence and limitations back to the parent. You do not communicate directly with the user.`

export function buildAgentSystemPrompt(profile: AgentPromptProfile) {
  const identity = profile.role === 'css-main'
    ? cssIdentity
    : profile.role === 'subagent'
      ? subagentIdentity
      : launcherIdentity
  const rules = [
    '## Operating rules',
    '- Be factual about actions actually completed.',
    '- Treat tool errors and unavailable capabilities as real constraints.',
    '- Runtime enforces destructive confirmations; never bypass or simulate approval.',
    '- For failures, gather evidence before proposing a fix.',
  ]
  if (profile.role === 'launcher-main') {
    rules.push('- Apply reversible, well-supported fixes directly. Escalate ambiguous choices or unavailable UI actions to the user.')
  }
  if (profile.role === 'css-main') {
    rules.push('- Read existing CSS before replacing it. After writing CSS, enable it unless the user explicitly asked otherwise.')
    rules.push('- Use UI inspection only when the `ui` tool is actually available.')
  }
  if (profile.role === 'subagent') {
    rules.push('- If UI or confirmation is required, stop and report the exact blocked action to the parent.')
  }
  return [
    identity,
    rules.join('\n'),
    capabilitySection(profile),
    profile.taskContext ? `## Assigned task\n${profile.taskContext}` : '',
    profile.sessionContext ? `## Launcher session context\n${profile.sessionContext}` : '',
    `## Response language\nReply in ${profile.locale}. Keep tool names, paths, identifiers, commands, CSS, and JSON fields in English.`,
  ].filter(Boolean).join('\n\n')
}
