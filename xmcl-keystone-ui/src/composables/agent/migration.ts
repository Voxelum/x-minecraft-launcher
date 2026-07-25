import type { AgentId, AgentMessage, LegacyConversationImport } from '@xmcl/runtime-api'

interface LegacyImporter {
  importLegacyConversation(input: LegacyConversationImport): Promise<'imported' | 'exists'>
}

export function convertLegacyAgentMessage(message: any): AgentMessage {
  let content = message.content ?? null
  if (Array.isArray(content)) {
    content = content.map((part: any) => part.type === 'text'
      ? { type: 'text', text: String(part.text ?? '') }
      : { type: 'image_url', image_url: part.image_url })
  }
  return {
    role: message.role,
    content,
    toolCalls: message.toolCalls ?? message.tool_calls?.map((call: any) => {
      let args = {}
      try { args = JSON.parse(call.function.arguments || '{}') } catch {}
      return { id: call.id, name: call.function.name, arguments: args }
    }),
    toolCallId: message.toolCallId ?? message.tool_call_id,
    name: message.name,
    isError: message.isError,
  }
}

/**
 * Migrate the legacy per-instance launcher conversations previously stored in
 * localStorage into the runtime history store, then drop the localStorage key.
 * Safe to call repeatedly: it no-ops once the key has been removed.
 */
export async function migrateLegacyLauncherConversations(service: LegacyImporter) {
  const raw = localStorage.getItem('agentConversationByInstanceV1')
  if (!raw) return
  try {
    const store = JSON.parse(raw)
    for (const [scope, saved] of Object.entries<any>(store?.byInstance ?? {})) {
      await service.importLegacyConversation({
        key: { agentId: 'launcher', scope },
        messages: (saved.messages ?? []).map(convertLegacyAgentMessage),
        context: saved.snapshot,
        updatedAt: saved.updatedAt,
      })
    }
    localStorage.removeItem('agentConversationByInstanceV1')
  } catch {}
}

/**
 * Migrate the single legacy CSS-agent conversation from localStorage into the
 * runtime history store, then drop the localStorage key.
 */
export async function migrateLegacyCssConversation(service: LegacyImporter, agentId: AgentId = 'css') {
  const raw = localStorage.getItem('cssAgentConversationV1')
  if (!raw) return
  try {
    const saved = JSON.parse(raw)
    await service.importLegacyConversation({
      key: { agentId, scope: 'global' },
      messages: (saved.messages ?? []).map(convertLegacyAgentMessage),
      updatedAt: saved.updatedAt,
    })
    localStorage.removeItem('cssAgentConversationV1')
  } catch {}
}
