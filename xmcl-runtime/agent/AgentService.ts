import {
  AgentServiceKey,
  BUILTIN_AGENT_FLIGHT,
  DEFAULT_AGENT_ENDPOINT,
  DEFAULT_AGENT_MODEL,
  isKeylessAgentEndpoint,
  type AgentConversationKey,
  type AgentMessage,
  type AgentProviderSettings,
  type AgentRunTrace,
  type AgentService as IAgentService,
  type LegacyConversationImport,
  type UpdateAgentProviderSettings,
} from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { Inject, LauncherAppKey, type LauncherApp } from '~/app'
import { IS_DEV } from '~/constant'
import { kFlights } from '~/infra'
import { kSettings } from '~/settings'
import { AbstractService, ExposeServiceKey } from '~/service'
import { AgentApiKeyStore } from './apiKey'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount'
import { sanitizeAgentEndpoint, sanitizeAgentLog } from './debug'
import { AgentArtifactStore } from './artifacts'
import { AgentDocumentStore, kAgentDocumentDirectory } from './documents'
import { AgentHistoryStore } from './history'

export { SECRET_SERVICE as AGENT_SECRET_SERVICE } from './apiKey'

export type ResolvedAgentProvider =
  | { mode: 'builtin' }
  | { mode: 'custom'; endpoint: string; model: string; apiKey: string }
  | { mode: 'unconfigured' }

export const kResolvedAgentProvider = Symbol('resolved-agent-provider')

@ExposeServiceKey(AgentServiceKey)
export class AgentService extends AbstractService implements IAgentService {
  private history = new AgentHistoryStore(join(this.app.appDataPath, 'agent', 'history'), message => this.warn(message))
  private artifacts = new AgentArtifactStore(join(this.app.appDataPath, 'agent', 'artifacts'))
  private documents: AgentDocumentStore
  private agentLogger = this.app.getLogger('Agent', 'agent')
  private apiKeys = new AgentApiKeyStore(this.app.secretStorage, async () => {
    const settings = await this.app.registry.get(kSettings)
    return settings.agentEndpoint || DEFAULT_AGENT_ENDPOINT
  })

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kAgentDocumentDirectory) private readonly documentDirectory: string,
  ) {
    super(app)
    this.documents = new AgentDocumentStore(documentDirectory)
  }

  async getProviderSettings(): Promise<AgentProviderSettings> {
    const settings = await this.app.registry.get(kSettings)
    const endpoint = settings.agentEndpoint || DEFAULT_AGENT_ENDPOINT
    const provider = await this[kResolvedAgentProvider]()
    const configured = provider.mode === 'custom'
      ? isKeylessAgentEndpoint(endpoint) || !!await this.apiKeys.get(endpoint)
      : provider.mode === 'builtin' && !!await this.app.registry.getOrCreate(XmclAccountService)
        .then(service => service[kXmclSessionAuthorization]())
        .catch(() => undefined)
    return {
      endpoint,
      model: settings.agentModel || DEFAULT_AGENT_MODEL,
      configured,
      mode: provider.mode === 'builtin' ? 'builtin' : 'custom',
    }
  }

  async setProviderSettings(input: UpdateAgentProviderSettings) {
    const settings = await this.app.registry.get(kSettings)
    const endpoint = input.endpoint.trim()
    this.logAgent(`[provider.settings] ${sanitizeAgentLog({
      endpoint: sanitizeAgentEndpoint(endpoint),
      model: input.model,
      hasApiKey: input.apiKey !== undefined,
    })}`)
    // Persist the secret first: it is the only step that can fail (OS keychain
    // errors), and we must not leave the endpoint/model settings committed while
    // the API key write was rejected. The key is scoped to the endpoint being
    // saved, so each provider keeps its own.
    if (input.apiKey !== undefined && endpoint) {
      await this.apiKeys.put(endpoint, input.apiKey)
    }
    settings.agentProviderSet({
      endpoint,
      model: input.model.trim(),
    })
  }

  async [kResolvedAgentProvider](): Promise<ResolvedAgentProvider> {
    const settings = await this.app.registry.get(kSettings)
    const endpoint = settings.agentEndpoint.trim()
    const model = settings.agentModel.trim()
    if (endpoint && model) {
      const apiKey = await this.apiKeys.get(endpoint)
        ?? (isKeylessAgentEndpoint(endpoint) ? 'not-needed' : '')
      return { mode: 'custom', endpoint, model, apiKey }
    }

    const flights = await this.app.registry.get(kFlights).catch((): Record<string, any> => ({}))
    return flights[BUILTIN_AGENT_FLIGHT] === true ? { mode: 'builtin' } : { mode: 'unconfigured' }
  }

  getConversation(key: AgentConversationKey) {
    return this.history.load(key)
  }

  updateConversationContext(key: AgentConversationKey, context: Record<string, unknown>) {
    return this.history.updateContext(key, context)
  }

  async appendConversationMessages(key: AgentConversationKey, messages: AgentMessage[]) {
    for (const message of messages) await this.history.appendMessage(key, message)
  }

  replaceConversationMessages(key: AgentConversationKey, messages: AgentMessage[]) {
    return this.history.replaceMessages(key, messages)
  }

  async startNewConversation(key: AgentConversationKey) {
    const archiveId = randomUUID()
    const historyArchived = await this.history.archive(key, archiveId)
    try {
      const artifactsArchived = await this.artifacts.archive(key, archiveId)
      return historyArchived || artifactsArchived ? archiveId : undefined
    } catch (error) {
      if (historyArchived) await this.history.restoreArchive(key, archiveId)
      throw error
    }
  }

  async resetConversation(key: AgentConversationKey) {
    await Promise.all([this.history.reset(key), this.artifacts.reset(key)])
  }

  writeArtifact(key: AgentConversationKey, input: { content: string; toolName: string }) {
    return this.artifacts.write(key, input.content, input.toolName)
  }

  listArtifacts(key: AgentConversationKey) {
    return this.artifacts.list(key)
  }

  readArtifact(key: AgentConversationKey, input: { path: string; offset?: number; limit?: number }) {
    return this.artifacts.read(key, input.path, input.offset, input.limit)
  }

  grepArtifact(key: AgentConversationKey, input: { path: string; pattern: string; ignoreCase: boolean; offset?: number; limit?: number }) {
    return this.artifacts.grep(key, input.path, input.pattern, input.ignoreCase, input.offset, input.limit)
  }

  listDocuments() {
    return this.documents.list()
  }

  searchDocuments(input: { query: string; limit?: number }) {
    return this.documents.search(input.query, input.limit)
  }

  readDocument(id: string) {
    return this.documents.read(id)
  }

  importLegacyConversation(input: LegacyConversationImport) {
    return this.history.importLegacy(input)
  }

  async reportRunTrace(trace: AgentRunTrace) {
    this.app.emit('agent-run-trace', trace)
  }

  private logAgent(message: string) {
    if (!IS_DEV) return
    this.agentLogger.log(message)
    this.log(message)
  }
}
