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
  agentId: AgentId
}

export type AgentUiAction =
  | { action: 'navigate'; path: string }
  | { action: 'select_instance'; path: string }
  | { action: 'select_account'; id: string }
  | { action: 'confirm'; message: string; destructive?: boolean }
  | { action: 'query_dom'; selector: string; limit?: number }
  | { action: 'get_computed_style'; selector: string; properties?: string[] }
  | { action: 'get_dom_outline'; selector?: string; maxDepth?: number }

export interface AgentUiRequest {
  bridgeId: string
  runId: string
  callId: string
  input: AgentUiAction
  timeoutMs: number
}

export interface AgentUiResponse {
  bridgeId: string
  callId: string
  result?: unknown
  error?: string
}

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
  resolve(response: AgentUiResponse): Promise<void>
  onRunEvent(listener: (event: AgentRunEvent) => void): () => void
  onUiRequest(listener: (request: AgentUiRequest) => void): () => void
  onToolCancel(listener: (request: { bridgeId: string; runId: string; callId: string }) => void): () => void
}

export interface AgentService {
  getProviderSettings(): Promise<AgentProviderSettings>
  setProviderSettings(input: UpdateAgentProviderSettings): Promise<void>
  getConversation(key: AgentConversationKey): Promise<AgentConversation>
  getRun(runId: string): Promise<AgentRunSnapshot | undefined>
  startRun(input: StartAgentRunInput): Promise<{ runId: string }>
  attachConversation(key: AgentConversationKey, bridgeId: string): Promise<AgentConversationAttachment>
  attachRun(runId: string, bridgeId: string): Promise<AgentRunSnapshot>
  cancelRun(runId: string): Promise<void>
  resetConversation(key: AgentConversationKey): Promise<void>
  importLegacyConversation(input: LegacyConversationImport): Promise<'imported' | 'exists'>
  notifyContextChange(input: AgentContextChange): Promise<void>
}

export const AgentServiceKey: ServiceKey<AgentService> = 'AgentService'
