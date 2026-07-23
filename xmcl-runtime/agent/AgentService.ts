import { Agent, type AgentEvent as PiAgentEvent, type AgentMessage as PiAgentMessage, type AgentTool } from '@earendil-works/pi-agent-core'
import { Type, type AssistantMessage, type Message, type TextContent, type ToolResultMessage, type UserMessage } from '@earendil-works/pi-ai'
import {
  AgentServiceKey,
  type AgentConversation,
  type AgentConversationKey,
  type AgentContextChange,
  type AgentMessage,
  type AgentRunEvent,
  type AgentRunSnapshot,
  type AgentRunState,
  type AgentRunTrace,
  type AgentService as IAgentService,
  type AgentToolDefinition,
  type LegacyConversationImport,
  type StartAgentRunInput,
  type UpdateAgentProviderSettings,
} from '@xmcl/runtime-api'
import { createHash, randomUUID } from 'crypto'
import { join } from 'path'
import { Inject, LauncherAppKey, type LauncherApp } from '~/app'
import { kSettings } from '~/settings'
import { AbstractService, ExposeServiceKey } from '~/service'
import { IS_DEV } from '~/constant'
import { AgentBridge } from './AgentBridge'
import { sanitizeAgentEndpoint, sanitizeAgentLog } from './debug'
import { AgentHistoryStore } from './history'
import { createAgentModels } from './provider'

const SECRET_SERVICE = 'xmcl/agent'
const SECRET_ACCOUNT = 'default'
const DEFAULT_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions'
const DEFAULT_MODEL = 'agnes-2.0-flash'
const BUILTIN_TOOLS: Record<AgentConversationKey['agentId'], ReadonlySet<string>> = {
  launcher: new Set(['vfs_list', 'vfs_read', 'vfs_rm', 'bash', 'edit_config', 'edit_instance']),
  css: new Set(['get_custom_css', 'set_custom_css', 'set_custom_css_enabled', 'query_dom', 'get_computed_style', 'get_dom_outline']),
}

interface ActiveRun {
  snapshot: AgentRunSnapshot
  agent: Agent
  bridgeId: string
  maxTurns: number
  turnCount: number
  abortRequested: boolean
  limitExceeded: boolean
  toolCounts: Record<string, number>
  toolFailures: number
  inputTokens: number
  outputTokens: number
  provider: string
  model: string
  lastStreamText: string
}

function keyString(key: AgentConversationKey) {
  return `${key.agentId}\0${key.scope}`
}

function contentText(content: AssistantMessage['content'] | ToolResultMessage['content']) {
  return content.filter((part): part is TextContent => part.type === 'text').map(part => part.text).join('')
}

function assistantText(message: PiAgentMessage) {
  return message.role === 'assistant' ? contentText(message.content) : ''
}

function fromPiMessage(message: PiAgentMessage): AgentMessage | undefined {
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

function zeroUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

function toPiMessage(message: AgentMessage, provider: string, model: string): Message | undefined {
  if (message.role === 'system') return undefined
  if (message.role === 'user') {
    const content = typeof message.content === 'string'
      ? message.content
      : (message.content ?? []).map(part => ({ type: 'text' as const, text: part.type === 'text' ? part.text ?? '' : `[image:${part.image_url?.url ?? ''}]` }))
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
    toolCallId: message.toolCallId ?? randomUUID(),
    toolName: message.name ?? 'unknown',
    content: [{ type: 'text', text: typeof message.content === 'string' ? message.content : '' }],
    isError: !!message.isError,
    timestamp: Date.now(),
  } satisfies ToolResultMessage
}

function resultText(value: unknown) {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function deterministicSample(runId: string, percentage: number) {
  const bucket = createHash('sha256').update(runId).digest().readUInt32BE(0) % 100
  return bucket < percentage
}

@ExposeServiceKey(AgentServiceKey)
export class AgentService extends AbstractService implements IAgentService {
  private history = new AgentHistoryStore(join(this.app.appDataPath, 'agent', 'history'), message => this.warn(message))
  private runs = new Map<string, ActiveRun>()
  private activeByConversation = new Map<string, string>()
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
    if (input.apiKey !== undefined) await this.app.secretStorage.put(SECRET_SERVICE, SECRET_ACCOUNT, input.apiKey.trim())
  }

  getConversation(key: AgentConversationKey) {
    return this.history.load(key)
  }

  async getRun(runId: string) {
    const run = this.runs.get(runId)
    return run ? structuredClone(run.snapshot) : undefined
  }

  async startRun(input: StartAgentRunInput) {
    const bridge = await this.app.registry.get(AgentBridge)
    const registration = bridge.getRegistration(input.bridgeId)
    if (!registration || registration.agentId !== input.key.agentId) throw new Error('Agent renderer bridge is not registered')
    if (this.activeByConversation.has(keyString(input.key))) throw new Error('Agent: a request is already in flight')

    const providerSettings = await this.getProviderSettings()
    if (!providerSettings.configured) throw new Error('Agent: API key is not configured')
    const apiKey = () => this.app.secretStorage.get(SECRET_SERVICE, SECRET_ACCOUNT)
    const { models, model, providerId } = createAgentModels(providerSettings.endpoint, providerSettings.model, apiKey)
    const conversation = await this.history.load(input.key)
    await this.history.ensureSession(input.key, input.context)
    const userMessage: AgentMessage = { role: 'user', content: input.input }
    await this.history.appendMessage(input.key, userMessage)

    const runId = randomUUID()
    const tools = this.createTools(runId, input, registration.capabilities, bridge)
    const agent = new Agent({
      initialState: {
        systemPrompt: input.systemPrompt,
        model,
        thinkingLevel: 'off',
        tools,
        messages: conversation.messages
          .map(message => toPiMessage(message, providerId, model.id))
          .filter((message): message is Message => !!message),
      },
      streamFn: models.streamSimple.bind(models),
      toolExecution: 'sequential',
      sessionId: runId,
      onPayload: payload => this.logAgent(`[provider.request] ${sanitizeAgentLog({
        endpoint: sanitizeAgentEndpoint(providerSettings.endpoint),
        model: model.id,
        payload,
      })}`),
      onResponse: response => this.logAgent(`[provider.response] ${sanitizeAgentLog({
        model: model.id,
        status: response.status,
      })}`),
    })
    const snapshot: AgentRunSnapshot = {
      runId,
      key: input.key,
      bridgeId: input.bridgeId,
      state: 'running',
      messages: [...conversation.messages, userMessage],
      startedAt: Date.now(),
    }
    const run: ActiveRun = {
      snapshot,
      agent,
      bridgeId: input.bridgeId,
      maxTurns: Math.min(Math.max(1, input.policy?.maxTurns ?? 10), 50),
      turnCount: 0,
      abortRequested: false,
      limitExceeded: false,
      toolCounts: {},
      toolFailures: 0,
      inputTokens: 0,
      outputTokens: 0,
      provider: providerId,
      model: model.id,
      lastStreamText: '',
    }
    this.runs.set(runId, run)
    this.activeByConversation.set(keyString(input.key), runId)
    this.logAgent(`[run.start] ${sanitizeAgentLog({ runId, agentId: input.key.agentId, model: model.id, tools: tools.map(tool => tool.name) })}`)
    bridge.sendRunEvent(input.bridgeId, { runId, type: 'state', state: 'running' })
    agent.subscribe(event => this.onPiEvent(run, event, bridge))
    void this.executeRun(run, input.input, bridge)
    return { runId }
  }

  async attachRun(runId: string, bridgeId: string) {
    const run = this.runs.get(runId)
    if (!run) throw new Error(`Agent run not found: ${runId}`)
    const bridge = await this.app.registry.get(AgentBridge)
    const registration = bridge.getRegistration(bridgeId)
    if (!registration || registration.agentId !== run.snapshot.key.agentId) throw new Error('Agent renderer bridge is not registered')
    run.bridgeId = bridgeId
    run.snapshot.bridgeId = bridgeId
    return structuredClone(run.snapshot)
  }

  async cancelRun(runId: string) {
    const run = this.runs.get(runId)
    if (!run || run.snapshot.state !== 'running') return
    run.abortRequested = true
    run.agent.abort()
  }

  async resetConversation(key: AgentConversationKey) {
    const runId = this.activeByConversation.get(keyString(key))
    if (runId) await this.cancelRun(runId)
    await this.history.reset(key)
  }

  importLegacyConversation(input: LegacyConversationImport) {
    return this.history.importLegacy(input)
  }

  async notifyContextChange(input: AgentContextChange) {
    const message: AgentMessage = { role: 'user', content: input.message }
    await this.history.appendMessage(input.key, message)
    if (input.context) await this.history.updateContext(input.key, input.context)
    const runId = this.activeByConversation.get(keyString(input.key))
    const run = runId ? this.runs.get(runId) : undefined
    if (run?.snapshot.state === 'running') {
      run.agent.steer({ role: 'user', content: input.message, timestamp: Date.now() })
    }
  }

  private createTools(runId: string, input: StartAgentRunInput, definitions: AgentToolDefinition[], bridge: AgentBridge): AgentTool[] {
    const allowed = input.policy?.allowedTools ? new Set(input.policy.allowedTools) : undefined
    const builtins = BUILTIN_TOOLS[input.key.agentId]
    return definitions
      .filter(definition => builtins.has(definition.name))
      .filter(definition => !allowed || allowed.has(definition.name))
      .filter(definition => !input.policy?.readonly || definition.readonly)
      .map(definition => ({
        name: definition.name,
        label: definition.name,
        description: definition.description,
        parameters: Type.Unsafe(definition.parameters),
        executionMode: 'sequential',
        execute: async (_toolCallId, args, signal) => {
          const timeoutMs = Math.min(Math.max(1_000, definition.timeoutMs ?? 5 * 60_000), 30 * 60_000)
          const bridgeId = this.runs.get(runId)?.bridgeId ?? input.bridgeId
          const value = await bridge.executeTool(bridgeId, runId, definition.name, args as Record<string, unknown>, timeoutMs, signal)
          return {
            content: [{ type: 'text', text: resultText(value) }],
            details: value,
          }
        },
      }))
  }

  private async onPiEvent(run: ActiveRun, event: PiAgentEvent, bridge: AgentBridge) {
    const runId = run.snapshot.runId
    if (event.type === 'message_update') {
      const text = assistantText(event.message)
      const delta = text.startsWith(run.lastStreamText) ? text.slice(run.lastStreamText.length) : text
      run.lastStreamText = text
      const message = fromPiMessage(event.message)
      if (message) bridge.sendRunEvent(run.bridgeId, { runId, type: 'message_delta', delta, message })
      return
    }
    if (event.type === 'message_end') {
      run.lastStreamText = ''
      const message = fromPiMessage(event.message)
      if (!message || message.role === 'user') return
      run.snapshot.messages.push(message)
      await this.history.appendMessage(run.snapshot.key, message)
      if (event.message.role === 'assistant') {
        run.inputTokens += event.message.usage.input
        run.outputTokens += event.message.usage.output
      }
      bridge.sendRunEvent(run.bridgeId, { runId, type: 'message_end', message })
      return
    }
    if (event.type === 'tool_execution_start') {
      run.toolCounts[event.toolName] = (run.toolCounts[event.toolName] ?? 0) + 1
      this.logAgent(`[tool.start] ${sanitizeAgentLog({ runId, name: event.toolName, arguments: event.args })}`)
      bridge.sendRunEvent(run.bridgeId, {
        runId,
        type: 'tool_start',
        toolCall: { id: event.toolCallId, name: event.toolName, arguments: event.args },
      })
      return
    }
    if (event.type === 'tool_execution_end') {
      if (event.isError) run.toolFailures++
      const result = resultText(event.result?.details ?? event.result?.content ?? event.result)
      this.logAgent(`[tool.end] ${sanitizeAgentLog({ runId, name: event.toolName, isError: event.isError, result })}`)
      bridge.sendRunEvent(run.bridgeId, {
        runId,
        type: 'tool_end',
        toolResult: { id: event.toolCallId, name: event.toolName, result, isError: event.isError },
      })
      return
    }
    if (event.type === 'turn_end') {
      run.turnCount++
      const hasToolCall = event.message.role === 'assistant' && event.message.content.some(part => part.type === 'toolCall')
      if (hasToolCall && run.turnCount >= run.maxTurns) {
        run.limitExceeded = true
        run.agent.abort()
      }
    }
  }

  private async executeRun(run: ActiveRun, input: string, bridge: AgentBridge) {
    let state: AgentRunState = 'completed'
    let error: string | undefined
    let stopReason = 'stop'
    try {
      await run.agent.prompt(input)
      const last = [...run.agent.state.messages].reverse().find((message): message is AssistantMessage => message.role === 'assistant')
      stopReason = last?.stopReason ?? 'stop'
      if (run.limitExceeded) {
        state = 'failed'
        error = `Agent stopped: exceeded ${run.maxTurns} iterations`
      } else if (run.abortRequested || stopReason === 'aborted') {
        state = 'aborted'
      } else if (last?.stopReason === 'error' || run.agent.state.errorMessage) {
        state = 'failed'
        error = last?.errorMessage ?? run.agent.state.errorMessage
      }
    } catch (e) {
      state = run.abortRequested ? 'aborted' : 'failed'
      error = e instanceof Error ? e.message : String(e)
      stopReason = state === 'aborted' ? 'aborted' : 'error'
    } finally {
      run.snapshot.state = state
      run.snapshot.finishedAt = Date.now()
      run.snapshot.error = error
      this.activeByConversation.delete(keyString(run.snapshot.key))
      bridge.sendRunEvent(run.bridgeId, error
        ? { runId: run.snapshot.runId, type: 'error', state, error }
        : { runId: run.snapshot.runId, type: 'complete', state })
      this.logAgent(`[run.end] ${sanitizeAgentLog({ runId: run.snapshot.runId, state, error, turns: run.turnCount, tools: run.toolCounts })}`)
      this.emitTrace(run, stopReason)
      this.pruneRuns()
    }
  }

  private emitTrace(run: ActiveRun, stopReason: string) {
    const percentage = run.snapshot.state === 'completed' ? 25 : 100
    if (!deterministicSample(run.snapshot.runId, percentage)) return
    const entries = Object.entries(run.toolCounts).sort((a, b) => b[1] - a[1])
    const tools = Object.fromEntries(entries.slice(0, 32))
    if (entries.length > 32) tools.other = entries.slice(32).reduce((sum, [, count]) => sum + count, 0)
    const trace: AgentRunTrace = {
      runId: run.snapshot.runId,
      agentId: run.snapshot.key.agentId,
      provider: run.provider,
      model: run.model,
      outcome: run.snapshot.state,
      stopReason,
      tools,
      turnCount: run.turnCount,
      toolCallCount: Object.values(run.toolCounts).reduce((sum, count) => sum + count, 0),
      toolFailureCount: run.toolFailures,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      durationMs: (run.snapshot.finishedAt ?? Date.now()) - run.snapshot.startedAt,
      sampleRate: percentage,
    }
    this.app.emit('agent-run-trace', trace)
  }

  private pruneRuns() {
    const finished = [...this.runs.values()]
      .filter(run => run.snapshot.state !== 'running')
      .sort((a, b) => (b.snapshot.finishedAt ?? 0) - (a.snapshot.finishedAt ?? 0))
    for (const run of finished.slice(50)) this.runs.delete(run.snapshot.runId)
  }

  private logAgent(message: string) {
    if (!IS_DEV) return
    this.agentLogger.log(message)
    this.log(message)
  }
}
