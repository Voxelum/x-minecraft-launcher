import type { ServiceKey } from './Service'

export type AgentId = 'launcher' | 'css'

export interface AgentConversationKey {
  agentId: AgentId
  scope: string
}

export interface AgentContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' }
}

export interface AgentToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | AgentContentPart[] | null
  toolCalls?: AgentToolCall[]
  toolCallId?: string
  name?: string
  isError?: boolean
}

export interface AgentConversation {
  key: AgentConversationKey
  messages: AgentMessage[]
  context?: Record<string, unknown>
  updatedAt?: number
}

export interface AgentProviderSettings {
  endpoint: string
  model: string
  configured: boolean
}

export interface UpdateAgentProviderSettings {
  endpoint: string
  model: string
  apiKey?: string
}

export interface AgentRunPolicy {
  allowedTools?: string[]
  readonly?: boolean
  maxDepth?: number
}

export interface StartAgentRunInput {
  key: AgentConversationKey
  bridgeId?: string
  input: string
  locale: string
  userId?: string
  parentRunId?: string
  depth?: number
  policy?: AgentRunPolicy
}

export type AgentRunState = 'running' | 'completed' | 'failed' | 'aborted'

export interface AgentRunSnapshot {
  runId: string
  key: AgentConversationKey
  bridgeId?: string
  eventSeq: number
  state: AgentRunState
  messages: AgentMessage[]
  startedAt: number
  finishedAt?: number
  error?: string
}

export interface AgentContextChange {
  key: AgentConversationKey
  message: string
  context?: Record<string, unknown>
}

export interface LegacyConversationImport {
  key: AgentConversationKey
  messages: AgentMessage[]
  context?: Record<string, unknown>
  updatedAt?: number
}

export interface AgentRunEvent {
  runId: string
  seq: number
  type: 'state' | 'message_delta' | 'message_end' | 'tool_start' | 'tool_end' | 'complete' | 'error'
  state?: AgentRunState
  message?: AgentMessage
  delta?: string
  toolCall?: AgentToolCall
  toolResult?: { id: string; name: string; result: string; isError?: boolean }
  error?: string
}

export interface AgentConversationAttachment {
  conversation: AgentConversation
  run?: AgentRunSnapshot
}

export interface AgentBridgeRegistration {
  bridgeId: string
}

export interface AgentProviderStreamRequest {
  bridgeId: string
  requestId: string
  model: Record<string, unknown>
  context: Record<string, unknown>
  options?: Record<string, unknown>
}

export type AgentProviderStreamEvent =
  | {
      bridgeId: string
      requestId: string
      type: 'event'
      event: unknown
    }
  | {
      bridgeId: string
      requestId: string
      type: 'error'
      error: string
    }

export type AgentMarketProvider = 'modrinth' | 'curseforge'

export interface AgentMarketProject {
  provider: AgentMarketProvider
  id: string
  title: string
  description: string
  icon?: string
  author?: string
  downloads?: number
}

export interface AgentMarketProjectListPresentation {
  type: 'market-project-list'
  source: AgentMarketProvider
  query: string
  total: number
  items: AgentMarketProject[]
}

export type AgentToolPresentation = AgentMarketProjectListPresentation

export type AgentUiAction =
  | { action: 'navigate'; path: string }
  | { action: 'select_instance'; path: string }
  | { action: 'select_account'; id: string }
  | {
      action: 'confirm'
      message: string
      title?: string
      details?: string[]
      confirmLabel?: string
      destructive?: boolean
    }
  | { action: 'query_dom'; selector: string; limit?: number }
  | { action: 'get_computed_style'; selector: string; properties?: string[] }
  | { action: 'get_dom_outline'; selector?: string; maxDepth?: number }

export interface AgentRunTrace {
  runId: string
  agentId: AgentId
  provider: string
  model: string
  outcome: AgentRunState
  stopReason: string
  tools: Record<string, number>
  turnCount: number
  toolCallCount: number
  toolFailureCount: number
  inputTokens: number
  outputTokens: number
  durationMs: number
  sampleRate: number
}

export interface AgentBridgeClient {
  register(registration: AgentBridgeRegistration): Promise<void>
  unregister(bridgeId: string): Promise<void>
  stream(request: AgentProviderStreamRequest): Promise<void>
  cancel(bridgeId: string, requestId: string): Promise<void>
  onProviderEvent(listener: (event: AgentProviderStreamEvent) => void): () => void
}

export interface AgentService {
  getProviderSettings(): Promise<AgentProviderSettings>
  setProviderSettings(input: UpdateAgentProviderSettings): Promise<void>
  getConversation(key: AgentConversationKey): Promise<AgentConversation>
  appendConversationMessages(key: AgentConversationKey, messages: AgentMessage[]): Promise<void>
  resetConversation(key: AgentConversationKey): Promise<void>
  importLegacyConversation(input: LegacyConversationImport): Promise<'imported' | 'exists'>
  notifyContextChange(input: AgentContextChange): Promise<void>
  reportRunTrace(trace: AgentRunTrace): Promise<void>
}

export const AgentServiceKey: ServiceKey<AgentService> = 'AgentService'
