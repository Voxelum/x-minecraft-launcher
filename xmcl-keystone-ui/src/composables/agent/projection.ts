import type {
  AgentMarketProjectListPresentation,
  AgentMarketProject,
  AgentMessage,
  AgentRunEvent,
  AgentToolCall,
  AgentToolPresentation,
} from '@xmcl/runtime-api'

export function selectPendingRunEvents(events: AgentRunEvent[], runId: string, afterSeq: number) {
  return events
    .filter(event => event.runId === runId && event.seq > afterSeq)
    .sort((a, b) => a.seq - b.seq)
}

export type AgentTranscriptItem =
  | { kind: 'message'; key: string; message: AgentMessage }
  | {
      kind: 'tool'
      key: string
      call: AgentToolCall
      result?: AgentMessage
      presentation?: AgentToolPresentation
    }

function contentText(message: AgentMessage) {
  if (!message.content) return ''
  if (typeof message.content === 'string') return message.content
  return message.content.map(part => part.type === 'text' ? part.text ?? '' : '[image]').join('')
}

function isMarketPresentation(value: unknown): value is AgentMarketProjectListPresentation {
  if (!value || typeof value !== 'object') return false
  const presentation = value as Partial<AgentMarketProjectListPresentation>
  return presentation.type === 'market-project-list'
    && (presentation.source === 'modrinth' || presentation.source === 'curseforge')
    && typeof presentation.query === 'string'
    && typeof presentation.total === 'number'
    && Array.isArray(presentation.items)
    && presentation.items.every(item => !!item
      && typeof item === 'object'
      && (item.provider === 'modrinth' || item.provider === 'curseforge')
      && (item.projectType === undefined || ['mod', 'resourcepack', 'shader', 'modpack', 'datapack'].includes(item.projectType))
      && typeof item.id === 'string'
      && typeof item.title === 'string'
      && typeof item.description === 'string')
}

export function parseAgentToolPresentation(message: AgentMessage | undefined): AgentToolPresentation | undefined {
  if (!message || message.isError) return undefined
  try {
    const parsed = JSON.parse(contentText(message))
    const presentation = parsed?.presentation
    if (!isMarketPresentation(presentation)) return undefined
    return {
      ...presentation,
      items: presentation.items.map((item: AgentMarketProject) => ({
        ...item,
        projectType: item.projectType ?? 'mod',
      })),
    }
  } catch {
    return undefined
  }
}

export function projectAgentTranscript(messages: AgentMessage[]): AgentTranscriptItem[] {
  const results = new Map<string, AgentMessage>()
  for (const message of messages) {
    if (message.role === 'tool' && message.toolCallId) results.set(message.toolCallId, message)
  }

  const attachedResults = new Set<string>()
  const items: AgentTranscriptItem[] = []
  messages.forEach((message, index) => {
    if (message.role === 'system' || message.role === 'tool') return
    if (message.role !== 'assistant' || !message.toolCalls?.length) {
      items.push({ kind: 'message', key: `message-${index}`, message })
      return
    }

    if (contentText(message)) {
      items.push({
        kind: 'message',
        key: `message-${index}`,
        message: { ...message, toolCalls: undefined },
      })
    }
    for (const call of message.toolCalls) {
      const result = results.get(call.id)
      if (result?.toolCallId) attachedResults.add(result.toolCallId)
      items.push({
        kind: 'tool',
        key: `tool-${call.id}`,
        call,
        result,
        presentation: parseAgentToolPresentation(result),
      })
    }
  })

  messages.forEach((message, index) => {
    if (message.role !== 'tool' || (message.toolCallId && attachedResults.has(message.toolCallId))) return
    const id = message.toolCallId ?? `orphan-${index}`
    items.push({
      kind: 'tool',
      key: `tool-${id}`,
      call: { id, name: message.name ?? 'tool', arguments: {} },
      result: message,
      presentation: parseAgentToolPresentation(message),
    })
  })
  return items
}
