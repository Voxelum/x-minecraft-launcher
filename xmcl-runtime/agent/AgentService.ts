import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, Usage } from '@earendil-works/pi-ai'
import {
  AgentServiceKey,
  type AgentContextChange,
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
import { sanitizeAgentEndpoint, sanitizeAgentLog, summarizeAgentProviderPayload } from './debug'
import { AgentHistoryStore } from './history'
import { createAgentProvider } from './provider'

const SECRET_SERVICE = 'xmcl/agent'
const SECRET_ACCOUNT = 'default'
const DEFAULT_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions'
const DEFAULT_MODEL = 'agnes-2.0-flash'

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

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async getProviderSettings() {
    const settings = await this.app.registry.get(kSettings)
    const configured = !!await this.app.secretStorage.get(SECRET_SERVICE, SECRET_ACCOUNT)
    return {
      endpoint: settings.agentEndpoint || DEFAULT_ENDPOINT,
      model: settings.agentModel || DEFAULT_MODEL,
      configured,
    }
  }

  async setProviderSettings(input: UpdateAgentProviderSettings) {
    const settings = await this.app.registry.get(kSettings)
    this.logAgent(`[provider.settings] ${sanitizeAgentLog({
      endpoint: sanitizeAgentEndpoint(input.endpoint),
      model: input.model,
      hasApiKey: input.apiKey !== undefined,
    })}`)
    settings.agentProviderSet({
      endpoint: input.endpoint.trim() || DEFAULT_ENDPOINT,
      model: input.model.trim() || DEFAULT_MODEL,
    })
    if (input.apiKey !== undefined) {
      await this.app.secretStorage.put(SECRET_SERVICE, SECRET_ACCOUNT, input.apiKey.trim())
    }
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

  async notifyContextChange(input: AgentContextChange) {
    await this.history.appendMessage(input.key, { role: 'user', content: input.message })
    if (input.context) await this.history.updateContext(input.key, input.context)
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

    const apiKey = await this.app.secretStorage.get(SECRET_SERVICE, SECRET_ACCOUNT)
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
