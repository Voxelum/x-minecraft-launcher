export interface AgentPromptCapability {
  name: string
  readonly?: boolean
}

export interface AgentPromptProfile {
  role: 'launcher-main' | 'css-main'
  locale: string
  tools: readonly AgentPromptCapability[]
  readonly: boolean
  sessionContext?: string
}

function capabilitySection(profile: AgentPromptProfile) {
  const names = new Set(profile.tools.map(tool => tool.name))
  const lines = [
    '## Capabilities',
    `Available tools: ${[...names].join(', ') || '(none)'}.`,
    profile.readonly
      ? 'This run is read-only. Do not claim that launcher state or files were changed.'
      : 'Use only the tools listed above. Read current state before modifying it.',
  ]
  if (names.has('bash')) {
    lines.push('The `bash` tool accepts exactly one XMCL command as its input. Do not prefix the input with `bash` and do not use pipes, redirects, `&&`, or `||`.')
    lines.push('Start with `help` or `help <command>`. Runtime commands include `market`, `version`, and `loader` for content search and mod-loader management.')
  }
  if (names.has('ui')) {
    lines.push('The `ui` tool is available for navigation, confirmation, and DOM inspection.')
    lines.push('Do not change the selected instance or account during a run. The run context is fixed when the user sends the message.')
  }
  return lines.join('\n')
}

const launcherIdentity = `You are the primary XMCL (X Minecraft Launcher) assistant. Help the user manage the explicitly selected Minecraft instance, resources, Java, local servers, worlds, launch failures, and launcher settings.`
const cssIdentity = `You are the XMCL Custom CSS assistant. Your only responsibility is inspecting the launcher UI and maintaining the global custom CSS document. Do not manage Minecraft instances, resources, accounts, or game launch.`

export function buildAgentSystemPrompt(profile: AgentPromptProfile) {
  const rules = [
    '## Operating rules',
    '- Be factual about actions actually completed.',
    '- Treat tool errors and unavailable capabilities as real constraints.',
    '- Destructive and install actions require explicit user confirmation.',
    '- For failures, gather evidence before proposing a fix.',
  ]
  if (profile.role === 'launcher-main') {
    rules.push('- Apply reversible, well-supported fixes directly. Escalate ambiguous choices to the user.')
  } else {
    rules.push('- Read existing CSS before replacing it. After writing CSS, enable it unless the user explicitly asked otherwise.')
  }
  return [
    profile.role === 'css-main' ? cssIdentity : launcherIdentity,
    rules.join('\n'),
    capabilitySection(profile),
    profile.sessionContext ? `## Launcher session context\n${profile.sessionContext}` : '',
    `## Response language\nReply in ${profile.locale}. Keep tool names, paths, identifiers, commands, CSS, and JSON fields in English.`,
  ].filter(Boolean).join('\n\n')
}
