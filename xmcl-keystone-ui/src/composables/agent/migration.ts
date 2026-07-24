import type { AgentMessage } from '@xmcl/runtime-api'

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
