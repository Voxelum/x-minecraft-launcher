import type { AgentMessage } from '@xmcl/runtime-api'
import type {
  AssistantMessage,
  Message,
  Model,
  TextContent,
  ToolResultMessage,
  Usage,
  UserMessage,
} from '@earendil-works/pi-ai'
import type { AgentMessage as PiAgentMessage } from '@earendil-works/pi-agent-core'

export function createAgentId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function contentText(content: AssistantMessage['content'] | ToolResultMessage['content']) {
  return content.filter((part): part is TextContent => part.type === 'text').map(part => part.text).join('')
}

export function fromPiMessage(message: PiAgentMessage): AgentMessage | undefined {
  if (message.role === 'user') {
    const content = typeof message.content === 'string'
      ? message.content
      : message.content.map(part => part.type === 'text'
        ? { type: 'text' as const, text: part.text }
        : { type: 'text' as const, text: `[image:${part.mimeType}]` })
    return { role: 'user', content }
  }
  if (message.role === 'assistant') {
    const text = contentText(message.content)
    const toolCalls = message.content
      .filter(part => part.type === 'toolCall')
      .map(part => ({ id: part.id, name: part.name, arguments: part.arguments }))
    return { role: 'assistant', content: text || null, toolCalls: toolCalls.length ? toolCalls : undefined }
  }
  if (message.role === 'toolResult') {
    return {
      role: 'tool',
      toolCallId: message.toolCallId,
      name: message.toolName,
      content: contentText(message.content),
      isError: message.isError,
    }
  }
}

export function zeroUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

export function toPiMessage(message: AgentMessage, provider: string, model: string): Message | undefined {
  if (message.role === 'system') return undefined
  if (message.role === 'user') {
    const content = typeof message.content === 'string'
      ? message.content
      : (message.content ?? []).map(part => ({
          type: 'text' as const,
          text: part.type === 'text' ? part.text ?? '' : `[image:${part.image_url?.url ?? ''}]`,
        }))
    return { role: 'user', content, timestamp: Date.now() } satisfies UserMessage
  }
  if (message.role === 'assistant') {
    const content: AssistantMessage['content'] = []
    const text = typeof message.content === 'string'
      ? message.content
      : (message.content ?? []).filter(part => part.type === 'text').map(part => part.text ?? '').join('')
    if (text) content.push({ type: 'text', text })
    for (const call of message.toolCalls ?? []) {
      content.push({ type: 'toolCall', id: call.id, name: call.name, arguments: call.arguments })
    }
    return {
      role: 'assistant',
      content,
      api: 'openai-completions',
      provider,
      model,
      usage: zeroUsage(),
      stopReason: message.toolCalls?.length ? 'toolUse' : 'stop',
      timestamp: Date.now(),
    } satisfies AssistantMessage
  }
  return {
    role: 'toolResult',
    toolCallId: message.toolCallId ?? createAgentId(),
    toolName: message.name ?? 'unknown',
    content: [{ type: 'text', text: typeof message.content === 'string' ? message.content : '' }],
    isError: !!message.isError,
    timestamp: Date.now(),
  } satisfies ToolResultMessage
}

export function createAgentModel(endpoint: string, modelId: string): Model<'openai-completions'> {
  const baseUrl = endpoint.trim().replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '')
  const provider = endpoint.includes('apihub.agnes-ai.com') ? 'agnes' : 'custom-openai'
  return {
    id: modelId,
    name: modelId,
    api: 'openai-completions',
    provider,
    baseUrl,
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  }
}
