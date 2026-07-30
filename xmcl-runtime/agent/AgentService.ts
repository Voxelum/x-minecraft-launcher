import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, Usage } from '@earendil-works/pi-ai'
import {
  AgentServiceKey,
  DEFAULT_AGENT_ENDPOINT,
  DEFAULT_AGENT_MODEL,
  isKeylessAgentEndpoint,
  type AgentConversationKey,
  type AgentMessage,
  type AgentProviderStreamRequest,
  type AgentRunTrace,
  type AgentService as IAgentService,
  type LegacyConversationImport,
  type UpdateAgentProviderSettings,
} from '@xmcl/runtime-api'
import { join } from 'path'
import { Inject, LauncherAppKey, type LauncherApp } from '~/app'
import { IS_DEV } from '~/constant'
import { kSettings } from '~/settings'
import { AbstractService, ExposeServiceKey } from '~/service'
import { AgentBridge } from './AgentBridge'
import { AgentApiKeyStore } from './apiKey'
import { sanitizeAgentEndpoint, sanitizeAgentLog, summarizeAgentProviderPayload } from './debug'
import { AgentHistoryStore } from './history'
import { createAgentProvider } from './provider'

function zeroUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

function requestKey(bridgeId: string, requestId: string) {
  return `${bridgeId}\0${requestId}`
}

@ExposeServiceKey(AgentServiceKey)
export class AgentService extends AbstractService implements IAgentService {
  private history = new AgentHistoryStore(join(this.app.appDataPath, 'agent', 'history'), message => this.warn(message))
  private providerRequests = new Map<string, AbortController>()
  private agentLogger = this.app.getLogger('Agent', 'agent')
  private apiKeys = new AgentApiKeyStore(this.app.secretStorage, async () => {
    const settings = await this.app.registry.get(kSettings)
    return settings.agentEndpoint || DEFAULT_AGENT_ENDPOINT
  })

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async getProviderSettings() {
    const settings = await this.app.registry.get(kSettings)
    const endpoint = settings.agentEndpoint || DEFAULT_AGENT_ENDPOINT
    // Keyless providers (a local Ollama, say) are ready as soon as they are
    // selected; requiring a placeholder key would just be a hoop to jump through.
    const configured = isKeylessAgentEndpoint(endpoint) || !!await this.apiKeys.get(endpoint)
    return {
      endpoint,
      model: settings.agentModel || DEFAULT_AGENT_MODEL,
      configured,
    }
  }

  async setProviderSettings(input: UpdateAgentProviderSettings) {
    const settings = await this.app.registry.get(kSettings)
    const endpoint = input.endpoint.trim() || DEFAULT_AGENT_ENDPOINT
    this.logAgent(`[provider.settings] ${sanitizeAgentLog({
      endpoint: sanitizeAgentEndpoint(endpoint),
      model: input.model,
      hasApiKey: input.apiKey !== undefined,
    })}`)
    // Persist the secret first: it is the only step that can fail (OS keychain
    // errors), and we must not leave the endpoint/model settings committed while
    // the API key write was rejected. The key is scoped to the endpoint being
    // saved, so each provider keeps its own.
    if (input.apiKey !== undefined) {
      await this.apiKeys.put(endpoint, input.apiKey)
    }
    settings.agentProviderSet({
      endpoint,
      model: input.model.trim() || DEFAULT_AGENT_MODEL,
    })
  }

  getConversation(key: AgentConversationKey) {
    return this.history.load(key)
  }

  async appendConversationMessages(key: AgentConversationKey, messages: AgentMessage[]) {
    for (const message of messages) await this.history.appendMessage(key, message)
  }

  resetConversation(key: AgentConversationKey) {
    return this.history.reset(key)
  }

  importLegacyConversation(input: LegacyConversationImport) {
    return this.history.importLegacy(input)
  }

  async reportRunTrace(trace: AgentRunTrace) {
    this.app.emit('agent-run-trace', trace)
  }

  async startProviderStream(request: AgentProviderStreamRequest, bridge: AgentBridge) {
    if (!bridge.has(request.bridgeId)) throw new Error('Agent provider bridge is unavailable')
    const key = requestKey(request.bridgeId, request.requestId)
    this.providerRequests.get(key)?.abort()
    const controller = new AbortController()
    this.providerRequests.set(key, controller)
    void this.runProviderStream(request, bridge, controller).finally(() => {
      if (this.providerRequests.get(key) === controller) this.providerRequests.delete(key)
    })
  }

  cancelProviderStream(bridgeId: string, requestId: string) {
    this.providerRequests.get(requestKey(bridgeId, requestId))?.abort()
  }

  cancelProviderBridge(bridgeId: string) {
    for (const [key, controller] of this.providerRequests) {
      if (key.startsWith(`${bridgeId}\0`)) controller.abort()
    }
  }

  private async runProviderStream(
    request: AgentProviderStreamRequest,
    bridge: AgentBridge,
    controller: AbortController,
  ) {
    const providerSettings = await this.getProviderSettings()
    if (!providerSettings.configured) {
      bridge.sendProviderEvent(request.bridgeId, {
        bridgeId: request.bridgeId,
        requestId: request.requestId,
        type: 'error',
        error: 'Agent API key is not configured',
      })
      return
    }

    // The OpenAI adapter expects a non-empty key even where the server ignores
    // it, so keyless providers get a placeholder rather than an empty header.
    const apiKey = await this.apiKeys.get(providerSettings.endpoint)
      ?? (isKeylessAgentEndpoint(providerSettings.endpoint) ? 'not-needed' : undefined)
    const { api, model, providerId } = createAgentProvider(providerSettings.endpoint, providerSettings.model)
    const options = {
      ...request.options,
      apiKey,
      signal: controller.signal,
      onPayload: (payload: unknown) => this.logAgent(`[provider.request] ${sanitizeAgentLog({
        endpoint: sanitizeAgentEndpoint(providerSettings.endpoint),
        model: model.id,
        payload: summarizeAgentProviderPayload(payload),
      })}`),
      onResponse: (response: any) => this.logAgent(`[provider.response] ${sanitizeAgentLog({
        model: model.id,
        status: response.status,
      })}`),
    } as unknown as SimpleStreamOptions

    try {
      const stream = api.streamSimple(
        model as Model<Api>,
        request.context as unknown as Context,
        options,
      )
      for await (const event of stream) {
        if (!bridge.sendProviderEvent(request.bridgeId, {
          bridgeId: request.bridgeId,
          requestId: request.requestId,
          type: 'event',
          event,
        })) {
          controller.abort()
          break
        }
      }
    } catch (error) {
      const aborted = controller.signal.aborted
      const message: AssistantMessage = {
        role: 'assistant',
        content: [],
        api: 'openai-completions',
        provider: providerId,
        model: model.id,
        usage: zeroUsage(),
        stopReason: aborted ? 'aborted' : 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      }
      bridge.sendProviderEvent(request.bridgeId, {
        bridgeId: request.bridgeId,
        requestId: request.requestId,
        type: 'event',
        event: {
          type: 'error',
          reason: aborted ? 'aborted' : 'error',
          error: message,
        },
      })
    }
  }

  private logAgent(message: string) {
    if (!IS_DEV) return
    this.agentLogger.log(message)
    this.log(message)
  }
}
