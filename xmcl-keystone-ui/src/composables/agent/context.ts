import type { AgentMessage } from '@xmcl/runtime-api'

export const AGENT_PASSIVE_CONTEXT_MESSAGE_NAME = 'passive-context'

export interface AgentPassiveContext {
  userId?: string
  page?: string
}

export interface AgentSessionContext {
  systemPrompt?: string
  passiveContext?: AgentPassiveContext
}

const runtimeLabels = [
  ['minecraft', 'Minecraft'],
  ['forge', 'Forge'],
  ['neoForged', 'NeoForge'],
  ['fabricLoader', 'Fabric Loader'],
  ['quiltLoader', 'Quilt Loader'],
  ['optifine', 'OptiFine'],
  ['labyMod', 'LabyMod'],
] as const

export function formatAgentRuntime(runtime: Record<string, unknown>) {
  const entries = runtimeLabels.flatMap(([key, label]) => {
    const version = runtime[key]
    return typeof version === 'string' && version ? [`- ${label}: ${version}`] : []
  })
  return entries.length ? ['Runtime:', ...entries].join('\n') : 'Runtime: (none)'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function readAgentSessionContext(context: Record<string, unknown> | undefined): AgentSessionContext {
  const passive = isRecord(context?.passiveContext) ? context.passiveContext : undefined
  return {
    systemPrompt: typeof context?.systemPrompt === 'string' ? context.systemPrompt : undefined,
    passiveContext: passive
      ? {
          userId: typeof passive.userId === 'string' ? passive.userId : undefined,
          page: typeof passive.page === 'string' ? passive.page : undefined,
        }
      : undefined,
  }
}

export function resolveAgentSessionSystemPrompt(stored: string | undefined, generated: string, compacted: boolean) {
  const renamedVfsShell = stored?.includes('The `bash` tool is a virtual XMCL command runner') && generated.includes('The `vfs_shell` tool is a virtual XMCL command runner')
  return !stored || compacted || renamedVfsShell ? generated : stored
}

export function createAgentPassiveContextMessage(
  previous: AgentPassiveContext | undefined,
  current: AgentPassiveContext,
): AgentMessage | undefined {
  const details: string[] = []
  if (previous && previous.userId !== current.userId) details.push(`Selected user id: ${current.userId || '(none)'}`)
  if (current.page) details.push(`Current launcher page: ${current.page}`)
  if (!details.length) return undefined
  return {
    role: 'system',
    name: AGENT_PASSIVE_CONTEXT_MESSAGE_NAME,
    content: [
      'Passive launcher context before the next user message:',
      ...details.map(detail => `- ${detail}`),
      'Treat this as context, not as a user instruction.',
    ].join('\n'),
  }
}