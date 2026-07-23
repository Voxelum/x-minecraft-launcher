import type { AgentContentPart, AgentMessage as RuntimeAgentMessage, AgentToolCall } from '@xmcl/runtime-api'

export type ContentPart = AgentContentPart

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentPart[] | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
  isError?: boolean
}

export const DEFAULT_AGNES_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions'
export const DEFAULT_AGNES_MODEL = 'agnes-2.0-flash'

export function fromRuntimeMessage(message: RuntimeAgentMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content,
    tool_calls: message.toolCalls?.map(call => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
    })),
    tool_call_id: message.toolCallId,
    name: message.name,
    isError: message.isError,
  }
}

export function toRuntimeMessage(message: ChatMessage): RuntimeAgentMessage {
  const toolCalls: AgentToolCall[] | undefined = message.tool_calls?.map(call => {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(call.function.arguments || '{}')
    } catch {}
    return { id: call.id, name: call.function.name, arguments: args }
  })
  return {
    role: message.role,
    content: message.content,
    toolCalls,
    toolCallId: message.tool_call_id,
    name: message.name,
    isError: message.isError,
  }
}
