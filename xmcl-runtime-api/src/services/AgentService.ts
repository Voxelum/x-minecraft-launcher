import type { ServiceKey } from './Service'

/** Internal endpoint intercepted by the launcher runtime before it reaches the network. */
export const BUILTIN_AGENT_ENDPOINT = 'https://ai.xmcl.app/v1/chat/completions'
/** Model selected by the built-in XMCL provider. */
export const BUILTIN_AGENT_MODEL = 'xmcl-agent'
/** Provider id used for the built-in XMCL provider. */
export const BUILTIN_AGENT_PROVIDER_ID = 'xmcl'
/** Default-off flight enabling the built-in XMCL provider. */
export const BUILTIN_AGENT_FLIGHT = 'builtinAgent'
/** Empty defaults select the built-in provider. */
export const DEFAULT_AGENT_ENDPOINT = ''
export const DEFAULT_AGENT_MODEL = ''
/** Working context target used to trigger compaction for agent models. */
export const AGENT_MODEL_CONTEXT_WINDOW = 256_000
/** Conservative max output tokens assumed for OpenAI-compatible agent models. */
export const AGENT_MODEL_MAX_TOKENS = 8_192

/** Provider id used for external OpenAI-compatible endpoints. */
export const CUSTOM_AGENT_PROVIDER_ID = 'custom-openai'

/** Strip the trailing `/chat/completions` and any trailing slashes to derive a base URL. */
export function normalizeAgentBaseUrl(endpoint: string) {
  return endpoint.trim().replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '')
}

/**
 * The `host` (hostname plus any explicit port) of an endpoint, lowercased.
 * Returns an empty string when the endpoint is not a parseable URL.
 */
function agentEndpointHost(endpoint: string) {
  try {
    return new URL(endpoint.trim()).host.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Derive a stable provider id from the configured endpoint.
 */
export function resolveAgentProviderId(endpoint: string) {
  if (!endpoint.trim()) return BUILTIN_AGENT_PROVIDER_ID
  const host = agentEndpointHost(endpoint)
  if (host === agentEndpointHost(BUILTIN_AGENT_ENDPOINT)) return BUILTIN_AGENT_PROVIDER_ID
  return CUSTOM_AGENT_PROVIDER_ID
}

/**
 * Secret-storage account under which the API key for `endpoint` is kept, so each
 * provider keeps its own key and switching providers does not require re-entering
 * one. Custom endpoints are additionally keyed by host, since two unrelated
 * self-hosted endpoints must not share a key.
 */
export function resolveAgentSecretAccount(endpoint: string) {
  const id = resolveAgentProviderId(endpoint)
  if (id !== CUSTOM_AGENT_PROVIDER_ID) return id
  const host = agentEndpointHost(endpoint) || normalizeAgentBaseUrl(endpoint).toLowerCase()
  return host ? `${id}@${host}` : id
}

export type AgentId = 'launcher' | 'css' | 'modpack-changelog'

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
  reasoningContent?: string
  toolCalls?: AgentToolCall[]
  toolCallId?: string
  name?: string
  isError?: boolean
  compaction?: { tokensBefore: number }
  contextTokens?: number
}

export interface AgentConversation {
  key: AgentConversationKey
  messages: AgentMessage[]
  context?: Record<string, unknown>
  updatedAt?: number
}

export interface AgentArtifactInfo {
  path: string
  length: number
  createdAt: number
}

export interface AgentArtifactRead extends AgentArtifactInfo {
  offset: number
  limit: number
  content: string
  hasMore: boolean
}

export interface AgentArtifactGrepResult {
  path: string
  offset: number
  limit: number
  totalMatches: number
  hasMore: boolean
  matches: Array<{ line: number; text: string }>
}

export interface AgentDocumentMetadata {
  id: string
  description: string
}

export interface AgentDocument extends AgentDocumentMetadata {
  body: string
}

export interface AgentDocumentSearchResult extends AgentDocumentMetadata {
  score: number
}

export interface AgentProviderSettings {
  endpoint: string
  model: string
  configured: boolean
  mode: 'builtin' | 'custom' | 'unconfigured'
}

export interface UpdateAgentProviderSettings {
  endpoint: string
  model: string
  apiKey?: string
}

export type AgentRunState = 'running' | 'completed' | 'failed' | 'aborted'

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

export type AgentMarketProvider = 'modrinth' | 'curseforge'
export type AgentMarketProjectType = 'mod' | 'resourcepack' | 'shader' | 'modpack' | 'datapack'

export interface AgentMarketProject {
  provider: AgentMarketProvider
  projectType: AgentMarketProjectType
  id: string
  title: string
  description: string
  icon?: string
  author?: string
  downloads?: number
  installRef?: string
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
      presentations?: AgentMarketProjectListPresentation[]
      confirmLabel?: string
      destructive?: boolean
      allowAll?: boolean
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

export interface AgentService {
  getProviderSettings(): Promise<AgentProviderSettings>
  setProviderSettings(input: UpdateAgentProviderSettings): Promise<void>
  getConversation(key: AgentConversationKey): Promise<AgentConversation>
  updateConversationContext(key: AgentConversationKey, context: Record<string, unknown>): Promise<void>
  appendConversationMessages(key: AgentConversationKey, messages: AgentMessage[]): Promise<void>
  replaceConversationMessages(key: AgentConversationKey, messages: AgentMessage[]): Promise<void>
  startNewConversation(key: AgentConversationKey): Promise<string | undefined>
  resetConversation(key: AgentConversationKey): Promise<void>
  writeArtifact(key: AgentConversationKey, input: { content: string; toolName: string }): Promise<AgentArtifactInfo>
  listArtifacts(key: AgentConversationKey): Promise<AgentArtifactInfo[]>
  readArtifact(key: AgentConversationKey, input: { path: string; offset?: number; limit?: number }): Promise<AgentArtifactRead>
  grepArtifact(key: AgentConversationKey, input: { path: string; pattern: string; ignoreCase: boolean; offset?: number; limit?: number }): Promise<AgentArtifactGrepResult>
  listDocuments(): Promise<AgentDocumentMetadata[]>
  searchDocuments(input: { query: string; limit?: number }): Promise<AgentDocumentSearchResult[]>
  readDocument(id: string): Promise<AgentDocument>
  importLegacyConversation(input: LegacyConversationImport): Promise<'imported' | 'exists'>
  reportRunTrace(trace: AgentRunTrace): Promise<void>
}

export const AgentServiceKey: ServiceKey<AgentService> = 'AgentService'
