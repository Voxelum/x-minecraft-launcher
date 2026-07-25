import type { ServiceKey } from './Service'

/** Conservative context window assumed for OpenAI-compatible agent models. */
export const AGENT_MODEL_CONTEXT_WINDOW = 128_000
/** Conservative max output tokens assumed for OpenAI-compatible agent models. */
export const AGENT_MODEL_MAX_TOKENS = 8_192

/** Provider id used when the endpoint does not match any known preset. */
export const CUSTOM_AGENT_PROVIDER_ID = 'custom-openai'

/**
 * A selectable OpenAI-completions compatible provider. Providers requiring OAuth
 * are intentionally not modelled here: every preset authenticates with an API key.
 */
export interface AgentProviderPreset {
  id: string
  /** Display name shown in the provider dropdown. */
  name: string
  /** Chat completions endpoint pre-filled when the preset is selected. */
  endpoint: string
  /** Model pre-filled when the preset is selected. */
  defaultModel: string
  /** Host fragment used to map an arbitrary endpoint back to this preset. */
  host: string
  /**
   * Set for providers that need no credentials (a local server, say), so the
   * agent is usable without the user inventing a placeholder key.
   */
  keyless?: boolean
  /** Where the user can obtain an API key. */
  apiKeyUrl?: string
}

/**
 * Built-in providers. The first entry is the default so the out-of-the-box
 * behavior stays unchanged.
 *
 * Each `defaultModel` is the current-generation, best value-for-money model of
 * that provider (the cheap/fast tier, not the flagship), verified against the
 * provider's own docs in July 2026. Providers retire model ids fairly quickly,
 * so re-check these against the official model list when touching this table.
 */
export const AGENT_PROVIDER_PRESETS: readonly AgentProviderPreset[] = Object.freeze([
  {
    id: 'agnes',
    name: 'Agnes',
    endpoint: 'https://apihub.agnes-ai.com/v1/chat/completions',
    defaultModel: 'agnes-2.0-flash',
    host: 'apihub.agnes-ai.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    // Cheapest GPT-5.6 tier ($1/$6 per 1M), 1M context.
    defaultModel: 'gpt-5.6-luna',
    host: 'api.openai.com',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    // `deepseek-chat` was retired 2026-07-24; V4-Flash is the value tier.
    defaultModel: 'deepseek-v4-flash',
    host: 'api.deepseek.com',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openai/gpt-5.6-luna',
    host: 'openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    // Mid-size open model with tool calling; far cheaper than the 700B+ flagships.
    defaultModel: 'Qwen/Qwen3.6-27B',
    host: 'api.siliconflow.cn',
    apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    // The moonshot-v1 series sunsets 2026-08-31; K3 is the current generation.
    defaultModel: 'kimi-k3',
    host: 'api.moonshot.cn',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    // Current flagship generation; GLM-4.x is superseded and partly retired.
    defaultModel: 'glm-5.2',
    host: 'open.bigmodel.cn',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    // Tool-capable coding model that fits a 24-32GB machine. Local models are
    // hardware-bound, so this is a starting point users are expected to change.
    defaultModel: 'qwen3-coder:30b',
    host: 'localhost:11434',
    keyless: true,
  },
])

/** Default OpenAI-compatible provider preset. */
export const DEFAULT_AGENT_PROVIDER = AGENT_PROVIDER_PRESETS[0]

/** Default OpenAI-compatible agent endpoint. The API key is stored separately. */
export const DEFAULT_AGENT_ENDPOINT = DEFAULT_AGENT_PROVIDER.endpoint
/** Default agent model identifier. */
export const DEFAULT_AGENT_MODEL = DEFAULT_AGENT_PROVIDER.defaultModel

export function getAgentProviderPreset(id: string) {
  return AGENT_PROVIDER_PRESETS.find(preset => preset.id === id)
}

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
 * Derive a stable provider id from the configured endpoint. Endpoints that do not
 * belong to a known preset are reported as a generic custom OpenAI provider.
 *
 * The host must match a preset exactly. A substring test would treat
 * `api.openai.com.example.net` as OpenAI, and since the stored API key is keyed
 * off this id, that would hand the user's real OpenAI key to an unrelated host.
 */
export function resolveAgentProviderId(endpoint: string) {
  const host = agentEndpointHost(endpoint)
  if (!host) return CUSTOM_AGENT_PROVIDER_ID
  return AGENT_PROVIDER_PRESETS.find(preset => preset.host.toLowerCase() === host)?.id ?? CUSTOM_AGENT_PROVIDER_ID
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

/** Whether `endpoint` belongs to a preset that needs no API key. */
export function isKeylessAgentEndpoint(endpoint: string) {
  return !!getAgentProviderPreset(resolveAgentProviderId(endpoint))?.keyless
}

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

export interface AgentBridgeRegistration {
  bridgeId: string
}

export interface AgentProviderStreamRequest {
  bridgeId: string
  requestId: string
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
  reportRunTrace(trace: AgentRunTrace): Promise<void>
}

export const AgentServiceKey: ServiceKey<AgentService> = 'AgentService'
