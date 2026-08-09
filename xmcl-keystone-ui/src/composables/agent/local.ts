import { Agent, type AgentEvent, type AgentTool } from '@earendil-works/pi-agent-core'
import {
  AGENT_MODEL_CONTEXT_WINDOW,
  BUILTIN_AGENT_ENDPOINT,
} from '@xmcl/runtime-api'
import {
  type Api,
  type AssistantMessage,
  type Message,
  type SimpleStreamOptions,
  type StreamFunction,
} from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import {
  AgentServiceKey,
  type AgentConversationKey,
  type AgentId,
  type AgentMessage,
  type AgentRunEvent,
  type AgentRunTrace,
} from '@xmcl/runtime-api'
import { computed, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useService } from '../service'
import { agentDebug } from './debug'
import { AGENT_COMPACTION_SYSTEM_PROMPT, compactedMessages, estimateAgentContextTokens, prepareAgentCompaction, toCompactionInput } from './compaction'
import { buildAgentSystemPrompt, createXmclBuiltInPayload, type AgentPromptSessionContext, type XmclBuiltInAgentContext } from './prompt'
import { contentText, createAgentId, createAgentModel, fromPiMessage, getAgentContextTokens, toPiMessage } from './protocol'
import { useAgentSettings } from './settings'
import { createAgentToolFailureGuard, stringifyAgentToolEventResult, wrapAgentToolsWithErrorNormalization, wrapAgentToolsWithResultSpill } from './toolSupport'
import { createAgentPassiveContextMessage, readAgentSessionContext, resolveAgentSessionSystemPrompt, type AgentPassiveContext } from './context'
import { createAgentPassiveEventMessage, registerAgentPassiveEventConsumer, type AgentPassiveEvent } from './passiveEvents'
import { clearAgentConfirmationScope, registerAgentConfirmationScope } from './confirm'

export interface AgentRunContext {
  agentId: AgentId
  scope: string
  permissionScope: string
  locale: string
  userId?: string
}

export interface LocalAgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly runError: Ref<string>
  readonly messages: Ref<AgentMessage[]>
  readonly events: Ref<AgentRunEvent[]>
  readonly contextUsage: Readonly<Ref<AgentContextUsage>>
  load(scope?: string): Promise<void>
  replaceMessages(messages: AgentMessage[]): Promise<void>
  send(userInput: string): Promise<void>
  reset(): Promise<void>
  abort(): void
}

export interface AgentContextUsage {
  usedTokens: number
  contextWindow: number
}

export interface LocalAgentOptions {
  agentId: AgentId
  getScope(): string
  getLocale(): string
  getUserId?(): string | undefined
  getPassiveContext?(context: AgentRunContext): AgentPassiveContext
  drainPassiveEvents?(context: AgentRunContext): AgentPassiveEvent[]
  createTools(context: AgentRunContext): Promise<AgentTool[]>
  getSessionContext(context: AgentRunContext): AgentPromptSessionContext
}

export function useLocalAgent(options: LocalAgentOptions): LocalAgentSession {
  const service = useService(AgentServiceKey)
  const settings = useAgentSettings()
  const running = ref(false)
  const runError = ref('')
  const messages = shallowRef<AgentMessage[]>([])
  const events = shallowRef<AgentRunEvent[]>([])
  const contextUsage = ref<AgentContextUsage>({ usedTokens: 0, contextWindow: AGENT_MODEL_CONTEXT_WINDOW })
  let currentScope = options.getScope()
  let activeAgent: Agent | undefined
  let currentRunId = ''
  let eventSeq = 0
  let streamingIndex = -1
  let loadVersion = 0
  let conversationContext: Record<string, unknown> = {}
  let activeBuiltInContext: XmclBuiltInAgentContext | undefined

  const providerApi = openAICompletionsApi()
  const streamFn: StreamFunction<Api, SimpleStreamOptions> = (model, context, streamOptions) => {
    const transportModel = createAgentModel(BUILTIN_AGENT_ENDPOINT, model.id)
    return providerApi.streamSimple(transportModel, context, {
      ...streamOptions,
      apiKey: 'runtime-managed',
      onPayload: settings.mode.value === 'builtin'
        ? payload => {
            if (!activeBuiltInContext) throw new Error('Built-in agent request context is unavailable')
            return createXmclBuiltInPayload(payload, activeBuiltInContext)
          }
        : streamOptions?.onPayload,
    })
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
    contextUsage.value = { usedTokens: 0, contextWindow: AGENT_MODEL_CONTEXT_WINDOW }
    runError.value = ''
    running.value = false
    messages.value = conversation.messages
    conversationContext = conversation.context ?? {}
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
      const result = stringifyAgentToolEventResult(event.result)
      appendEvent({
        type: 'tool_end',
        toolResult: { id: event.toolCallId, name: event.toolName, result, isError: event.isError },
      })
    }
  }

  async function compactConversation(
    previousMessages: AgentMessage[],
    systemPrompt: string,
    pendingInput: string,
    providerModel: ReturnType<typeof createAgentModel>,
    requestContext: XmclBuiltInAgentContext,
  ) {
    const contextTokens = estimateAgentContextTokens(
      previousMessages,
      systemPrompt,
      pendingInput,
      providerModel.provider,
      providerModel.id,
    )
    const preparation = prepareAgentCompaction(previousMessages, contextTokens, providerModel.provider, providerModel.id)
    if (!preparation) return { messages: previousMessages, compacted: false }

    const summarizer = new Agent({
      initialState: {
        systemPrompt: AGENT_COMPACTION_SYSTEM_PROMPT,
        model: providerModel,
        thinkingLevel: 'off',
        tools: [],
        messages: toCompactionInput(preparation.messagesToSummarize, providerModel.provider, providerModel.id),
      },
      streamFn,
      sessionId: createAgentId(),
    })
    activeAgent = summarizer
    const previousBuiltInContext = activeBuiltInContext
    activeBuiltInContext = {
      promptVersion: 1,
      agentType: 'compaction',
      locale: requestContext.locale,
    }
    running.value = true
    try {
      await summarizer.prompt('Summarize the conversation above as a concise checkpoint. Preserve goals, constraints, completed work, exact paths and identifiers, current blockers, and next steps. Do not continue the conversation.')
      const response = [...summarizer.state.messages].reverse().find((message): message is AssistantMessage => message.role === 'assistant')
      const summary = response ? contentText(response.content).trim() : ''
      if (!summary || response?.stopReason === 'error' || response?.stopReason === 'aborted') {
        throw new Error(response?.errorMessage || `Context compaction ${response?.stopReason ?? 'returned no summary'}`)
      }
      const nextMessages = compactedMessages(preparation, summary)
      await service.replaceConversationMessages(key(), nextMessages)
      messages.value = nextMessages
      contextUsage.value = {
        usedTokens: estimateAgentContextTokens(nextMessages, systemPrompt, pendingInput, providerModel.provider, providerModel.id),
        contextWindow: providerModel.contextWindow,
      }
      return { messages: nextMessages, compacted: true }
    } finally {
      activeBuiltInContext = previousBuiltInContext
      if (activeAgent === summarizer) activeAgent = undefined
      running.value = false
    }
  }

  async function send(input: string) {
    await settings.ready
    await settings.flush()
    if (running.value) throw new Error('Agent: a request is already in flight')
    if (!settings.configured.value) throw new Error('Agent: provider is not configured')
    const scope = options.getScope()
    if (scope !== currentScope) await load(scope)
    const permissionScope = createAgentId()

    const runContext: AgentRunContext = {
      agentId: options.agentId,
      scope,
      permissionScope,
      locale: options.getLocale(),
      userId: options.getUserId?.(),
    }
    const createdTools = wrapAgentToolsWithErrorNormalization(await options.createTools(runContext))
    const supportsArtifacts = createdTools.some(tool => tool.name === 'vfs_read') && createdTools.some(tool => tool.name === 'vfs_shell')
    const artifactKey: AgentConversationKey = { agentId: options.agentId, scope }
    const tools = supportsArtifacts
      ? wrapAgentToolsWithResultSpill(createdTools, (content, toolName) => service.writeArtifact(artifactKey, { content, toolName }))
      : createdTools
    const providerModel = createAgentModel(settings.resolvedEndpoint.value, settings.resolvedModel.value)
    const role = options.agentId === 'css' ? 'css-main' : options.agentId === 'modpack-changelog' ? 'modpack-changelog-main' : 'launcher-main'
    const documents = role === 'launcher-main' && tools.some(tool => tool.name === 'vfs_shell')
      ? await service.listDocuments()
      : undefined
    const sessionContext = options.getSessionContext(runContext)
    const promptProfile = {
      role,
      locale: runContext.locale,
      tools: tools.map(tool => ({ name: tool.name })),
      readonly: false,
      documents,
      sessionContext,
    } as const
    const generatedSystemPrompt = buildAgentSystemPrompt(promptProfile)
    const builtInContext: XmclBuiltInAgentContext = {
      promptVersion: 1,
      agentType: options.agentId,
      locale: runContext.locale,
      documents,
      sessionContext,
    }
    const storedSessionContext = readAgentSessionContext(conversationContext)
    const initialSystemPrompt = resolveAgentSessionSystemPrompt(storedSessionContext.systemPrompt, generatedSystemPrompt, false)
    const passiveContext = options.getPassiveContext?.(runContext)
    const passiveMessage = passiveContext
      ? createAgentPassiveContextMessage(storedSessionContext.passiveContext, passiveContext)
      : undefined
    const passiveMessages = [
      ...(options.drainPassiveEvents?.(runContext) ?? []).map(createAgentPassiveEventMessage),
      ...(passiveMessage ? [passiveMessage] : []),
    ]
    if (passiveMessages.length) {
      messages.value = [...messages.value, ...passiveMessages]
      await service.appendConversationMessages(key(), passiveMessages)
    }
    const passiveContextChanged = passiveContext && (
      passiveContext.userId !== storedSessionContext.passiveContext?.userId ||
      passiveContext.page !== storedSessionContext.passiveContext?.page
    )
    const contextPatch: Record<string, unknown> = {}
    if (!storedSessionContext.systemPrompt) contextPatch.systemPrompt = initialSystemPrompt
    if (passiveContextChanged) contextPatch.passiveContext = passiveContext
    if (Object.keys(contextPatch).length) {
      await service.updateConversationContext(key(scope), contextPatch)
      conversationContext = { ...conversationContext, ...contextPatch }
    }

    const compacted = await compactConversation(messages.value, initialSystemPrompt, input, providerModel, builtInContext)
    const systemPrompt = resolveAgentSessionSystemPrompt(storedSessionContext.systemPrompt, generatedSystemPrompt, compacted.compacted)
    if (compacted.compacted) {
      await service.updateConversationContext(key(scope), { systemPrompt })
      conversationContext = { ...conversationContext, systemPrompt }
      contextUsage.value = {
        usedTokens: estimateAgentContextTokens(compacted.messages, systemPrompt, input, providerModel.provider, providerModel.id),
        contextWindow: providerModel.contextWindow,
      }
    }
    const previousMessages = compacted.messages
      .map(message => toPiMessage(message, providerModel.provider, providerModel.id))
      .filter((message): message is Message => !!message)
    const toolFailureGuard = createAgentToolFailureGuard(tools)
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
      beforeToolCall: toolFailureGuard.beforeToolCall,
      afterToolCall: toolFailureGuard.afterToolCall,
      sessionId: permissionScope,
    })
    activeAgent = agent
    activeBuiltInContext = builtInContext
    currentRunId = permissionScope
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
      if (event.type === 'message_end' && event.message.role === 'assistant') {
        toolFailureGuard.beginToolBatch()
        inputTokens += event.message.usage.input
        outputTokens += event.message.usage.output
        contextUsage.value = {
          usedTokens: getAgentContextTokens(event.message.usage),
          contextWindow: providerModel.contextWindow,
        }
      } else if (event.type === 'tool_execution_start') {
        toolCounts[event.toolName] = (toolCounts[event.toolName] ?? 0) + 1
      } else if (event.type === 'tool_execution_end') {
        toolFailureGuard.recordToolResult(event.toolName, event.isError)
        if (event.isError) toolFailures++
      }
      await applyAgentEvent(event)
    })
    const unregisterPassiveEvents = options.drainPassiveEvents
      ? registerAgentPassiveEventConsumer(scope, (event) => {
          const message = createAgentPassiveEventMessage(event)
          const steeringMessage = toPiMessage(message, providerModel.provider, providerModel.id)
          if (!steeringMessage || activeAgent !== agent || !running.value) return false
          messages.value = [...messages.value, message]
          void persist(message).catch(error => agentDebug('passive-event.persist.error', error))
          agent.steer(steeringMessage)
          return true
        })
      : () => undefined

    let outcome: AgentRunTrace['outcome'] = 'completed'
    let stopReason = 'stop'
  registerAgentConfirmationScope(permissionScope)
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
      unregisterPassiveEvents()
      clearAgentConfirmationScope(permissionScope)
      unsubscribe()
      if (activeAgent === agent) activeAgent = undefined
      if (activeBuiltInContext === builtInContext) activeBuiltInContext = undefined
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
    await service.startNewConversation(key())
    activeAgent = undefined
    messages.value = []
    events.value = []
    contextUsage.value = { usedTokens: 0, contextWindow: AGENT_MODEL_CONTEXT_WINDOW }
    runError.value = ''
    running.value = false
    conversationContext = {}
  }

  async function replaceMessages(nextMessages: AgentMessage[]) {
    activeAgent?.abort()
    await activeAgent?.waitForIdle().catch(() => undefined)
    await service.resetConversation(key())
    if (nextMessages.length) await service.appendConversationMessages(key(), nextMessages)
    messages.value = nextMessages
    events.value = []
    contextUsage.value = { usedTokens: 0, contextWindow: AGENT_MODEL_CONTEXT_WINDOW }
    runError.value = ''
    running.value = false
    conversationContext = {}
  }

  const abort = () => activeAgent?.abort()

  onUnmounted(() => {
    activeAgent?.abort()
  })

  return {
    available: computed(() => settings.configured.value),
    running,
    runError,
    messages,
    events,
    contextUsage,
    load,
    replaceMessages,
    send,
    reset,
    abort,
  }
}
