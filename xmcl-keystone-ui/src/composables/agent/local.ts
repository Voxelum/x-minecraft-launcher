import { Agent, type AgentEvent, type AgentTool } from '@earendil-works/pi-agent-core'
import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEvent,
  type Context,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type StreamFunction,
} from '@earendil-works/pi-ai'
import {
  AgentServiceKey,
  type AgentConversationKey,
  type AgentId,
  type AgentMessage,
  type AgentProviderStreamEvent,
  type AgentRunEvent,
  type AgentRunTrace,
} from '@xmcl/runtime-api'
import { computed, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useService } from '../service'
import { agentDebug } from './debug'
import { buildAgentSystemPrompt } from './prompt'
import { contentText, createAgentId, createAgentModel, fromPiMessage, toPiMessage, zeroUsage } from './protocol'
import { useAgentSettings } from './settings'

export interface AgentRunContext {
  agentId: AgentId
  scope: string
  locale: string
  userId?: string
}

export interface LocalAgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly runError: Ref<string>
  readonly messages: Ref<AgentMessage[]>
  readonly events: Ref<AgentRunEvent[]>
  load(scope?: string): Promise<void>
  replaceMessages(messages: AgentMessage[]): Promise<void>
  send(userInput: string): Promise<void>
  reset(): Promise<void>
  abort(): void
}

export interface LocalAgentOptions {
  agentId: AgentId
  getScope(): string
  getLocale(): string
  getUserId?(): string | undefined
  createTools(context: AgentRunContext): Promise<AgentTool[]>
  getSessionContext(context: AgentRunContext): string
}

interface PendingProviderStream {
  stream: ReturnType<typeof createAssistantMessageEventStream>
  model: Model<Api>
  signal?: AbortSignal
  onAbort?: () => void
}

function providerError(model: Model<Api>, message: string, aborted = false): AssistantMessageEvent {
  const error: AssistantMessage = {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: zeroUsage(),
    stopReason: aborted ? 'aborted' : 'error',
    errorMessage: message,
    timestamp: Date.now(),
  }
  return { type: 'error', reason: aborted ? 'aborted' : 'error', error }
}

function serializableOptions(options?: SimpleStreamOptions) {
  if (!options) return undefined
  return JSON.parse(JSON.stringify(options, (_key, value) => {
    if (typeof value === 'function' || value instanceof AbortSignal) return undefined
    return value
  }))
}

function serializableRecord(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export function useLocalAgent(options: LocalAgentOptions): LocalAgentSession {
  const service = useService(AgentServiceKey)
  const settings = useAgentSettings()
  const bridgeId = createAgentId()
  const bridgeReady = agentBridge.register({ bridgeId })
  const running = ref(false)
  const runError = ref('')
  const messages = shallowRef<AgentMessage[]>([])
  const events = shallowRef<AgentRunEvent[]>([])
  const pendingProviderStreams = new Map<string, PendingProviderStream>()
  let currentScope = options.getScope()
  let activeAgent: Agent | undefined
  let currentRunId = ''
  let eventSeq = 0
  let streamingIndex = -1
  let loadVersion = 0

  function finishProviderStream(requestId: string) {
    const pending = pendingProviderStreams.get(requestId)
    if (!pending) return
    if (pending.signal && pending.onAbort) pending.signal.removeEventListener('abort', pending.onAbort)
    pendingProviderStreams.delete(requestId)
  }

  const stopProviderEvents = agentBridge.onProviderEvent((event: AgentProviderStreamEvent) => {
    if (event.bridgeId !== bridgeId) return
    const pending = pendingProviderStreams.get(event.requestId)
    if (!pending) return
    if (event.type === 'error') {
      pending.stream.push(providerError(pending.model, event.error))
      finishProviderStream(event.requestId)
      return
    }
    const providerEvent = event.event as AssistantMessageEvent
    pending.stream.push(providerEvent)
    if (providerEvent.type === 'done' || providerEvent.type === 'error') finishProviderStream(event.requestId)
  })

  const streamFn: StreamFunction<Api, SimpleStreamOptions> = (model, context, streamOptions) => {
    const requestId = createAgentId()
    const stream = createAssistantMessageEventStream()
    const pending: PendingProviderStream = { stream, model, signal: streamOptions?.signal }
    if (streamOptions?.signal) {
      pending.onAbort = () => {
        void agentBridge.cancel(bridgeId, requestId)
      }
      streamOptions.signal.addEventListener('abort', pending.onAbort, { once: true })
    }
    pendingProviderStreams.set(requestId, pending)
    void bridgeReady.then(() => agentBridge.stream({
      bridgeId,
      requestId,
      context: serializableRecord(context),
      options: serializableOptions(streamOptions),
    })).catch((error) => {
      stream.push(providerError(model, error instanceof Error ? error.message : String(error)))
      finishProviderStream(requestId)
    })
    return stream
  }

  const key = (scope = currentScope): AgentConversationKey => ({ agentId: options.agentId, scope })

  async function load(scope = options.getScope()) {
    const version = ++loadVersion
    if (activeAgent) {
      activeAgent.abort()
      await activeAgent.waitForIdle().catch(() => undefined)
    }
    const conversation = await service.getConversation(key(scope))
    if (version !== loadVersion) return
    currentScope = scope
    currentRunId = ''
    eventSeq = 0
    streamingIndex = -1
    events.value = []
    runError.value = ''
    running.value = false
    messages.value = conversation.messages
  }

  function appendEvent(event: Omit<AgentRunEvent, 'runId' | 'seq'>) {
    events.value = [...events.value, { ...event, runId: currentRunId, seq: ++eventSeq }]
  }

  async function persist(message: AgentMessage) {
    await service.appendConversationMessages(key(), [message])
  }

  async function applyAgentEvent(event: AgentEvent) {
    if (event.type === 'message_update') {
      if (event.message.role !== 'assistant') return
      const message = fromPiMessage(event.message)
      if (!message || message.role !== 'assistant') return
      if (streamingIndex < 0) {
        streamingIndex = messages.value.length
        messages.value = [...messages.value, message]
      } else {
        const next = messages.value.slice()
        next[streamingIndex] = message
        messages.value = next
      }
      appendEvent({ type: 'message_delta', message, delta: contentText(event.message.content) })
      return
    }
    if (event.type === 'message_end') {
      const message = fromPiMessage(event.message)
      if (!message || message.role === 'user') return
      if (streamingIndex >= 0 && message.role === 'assistant') {
        const next = messages.value.slice()
        next[streamingIndex] = message
        messages.value = next
        streamingIndex = -1
      } else {
        messages.value = [...messages.value, message]
      }
      await persist(message)
      appendEvent({ type: 'message_end', message })
      return
    }
    if (event.type === 'tool_execution_start') {
      appendEvent({
        type: 'tool_start',
        toolCall: { id: event.toolCallId, name: event.toolName, arguments: event.args },
      })
      return
    }
    if (event.type === 'tool_execution_end') {
      const result = Array.isArray(event.result?.content)
        ? event.result.content.filter((part: any) => part?.type === 'text').map((part: any) => String(part.text ?? '')).join('')
        : String(event.result ?? '')
      appendEvent({
        type: 'tool_end',
        toolResult: { id: event.toolCallId, name: event.toolName, result, isError: event.isError },
      })
    }
  }

  async function send(input: string) {
    await Promise.all([bridgeReady, settings.ready])
    await settings.flush()
    if (running.value) throw new Error('Agent: a request is already in flight')
    if (!settings.configured.value) throw new Error('Agent: API key is not configured')
    const scope = options.getScope()
    if (scope !== currentScope) await load(scope)

    const runContext: AgentRunContext = {
      agentId: options.agentId,
      scope,
      locale: options.getLocale(),
      userId: options.getUserId?.(),
    }
    const tools = await options.createTools(runContext)
    const providerModel = createAgentModel(settings.resolvedEndpoint.value, settings.resolvedModel.value)
    const previousMessages = messages.value
      .map(message => toPiMessage(message, providerModel.provider, providerModel.id))
      .filter((message): message is Message => !!message)
    const systemPrompt = buildAgentSystemPrompt({
      role: options.agentId === 'css' ? 'css-main' : 'launcher-main',
      locale: runContext.locale,
      tools: tools.map(tool => ({ name: tool.name })),
      readonly: false,
      sessionContext: options.getSessionContext(runContext),
    })
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model: providerModel,
        thinkingLevel: 'off',
        tools,
        messages: previousMessages,
      },
      streamFn,
      toolExecution: 'sequential',
      sessionId: createAgentId(),
    })
    activeAgent = agent
    currentRunId = agent.sessionId ?? createAgentId()
    eventSeq = 0
    events.value = []
    runError.value = ''
    running.value = true

    const userMessage: AgentMessage = { role: 'user', content: input }
    messages.value = [...messages.value, userMessage]
    await persist(userMessage)

    const startedAt = Date.now()
    const toolCounts: Record<string, number> = {}
    let toolFailures = 0
    let inputTokens = 0
    let outputTokens = 0
    const unsubscribe = agent.subscribe(async (event) => {
      if (event.type === 'tool_execution_start') {
        toolCounts[event.toolName] = (toolCounts[event.toolName] ?? 0) + 1
      } else if (event.type === 'tool_execution_end' && event.isError) {
        toolFailures++
      } else if (event.type === 'message_end' && event.message.role === 'assistant') {
        inputTokens += event.message.usage.input
        outputTokens += event.message.usage.output
      }
      await applyAgentEvent(event)
    })

    let outcome: AgentRunTrace['outcome'] = 'completed'
    let stopReason = 'stop'
    try {
      await agent.prompt(input)
      const last = [...agent.state.messages].reverse().find((message): message is AssistantMessage => message.role === 'assistant')
      stopReason = last?.stopReason ?? 'stop'
      if (last?.stopReason === 'aborted') outcome = 'aborted'
      else if (last?.stopReason === 'error' || agent.state.errorMessage) {
        outcome = 'failed'
        runError.value = last?.errorMessage ?? agent.state.errorMessage ?? ''
      }
    } catch (error) {
      outcome = agent.signal?.aborted ? 'aborted' : 'failed'
      stopReason = outcome === 'aborted' ? 'aborted' : 'error'
      runError.value = error instanceof Error ? error.message : String(error)
      agentDebug('run.error', error)
    } finally {
      unsubscribe()
      if (activeAgent === agent) activeAgent = undefined
      running.value = false
      appendEvent(runError.value
        ? { type: 'error', state: outcome, error: runError.value }
        : { type: 'complete', state: outcome })
      await service.reportRunTrace({
        runId: currentRunId,
        agentId: options.agentId,
        provider: providerModel.provider,
        model: providerModel.id,
        outcome,
        stopReason,
        tools: toolCounts,
        turnCount: events.value.filter(event => event.type === 'message_end' && event.message?.role === 'assistant').length,
        toolCallCount: Object.values(toolCounts).reduce((sum, count) => sum + count, 0),
        toolFailureCount: toolFailures,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
        sampleRate: outcome === 'completed' ? 25 : 100,
      })
    }
  }

  async function reset() {
    activeAgent?.abort()
    await activeAgent?.waitForIdle().catch(() => undefined)
    await service.resetConversation(key())
    activeAgent = undefined
    messages.value = []
    events.value = []
    runError.value = ''
    running.value = false
  }

  async function replaceMessages(nextMessages: AgentMessage[]) {
    activeAgent?.abort()
    await activeAgent?.waitForIdle().catch(() => undefined)
    await service.resetConversation(key())
    if (nextMessages.length) await service.appendConversationMessages(key(), nextMessages)
    messages.value = nextMessages
    events.value = []
    runError.value = ''
    running.value = false
  }

  const abort = () => activeAgent?.abort()

  onUnmounted(() => {
    activeAgent?.abort()
    stopProviderEvents()
    for (const requestId of pendingProviderStreams.keys()) {
      void agentBridge.cancel(bridgeId, requestId)
      finishProviderStream(requestId)
    }
    void agentBridge.unregister(bridgeId)
  })

  return {
    available: computed(() => settings.configured.value),
    running,
    runError,
    messages,
    events,
    load,
    replaceMessages,
    send,
    reset,
    abort,
  }
}
