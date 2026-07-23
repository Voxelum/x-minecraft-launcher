import {
  AgentServiceKey,
  type AgentConversationKey,
  type AgentId,
  type AgentRunEvent as RuntimeRunEvent,
  type AgentToolRequest,
} from '@xmcl/runtime-api'
import { computed, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useService } from '../service'
import { fromRuntimeMessage, type ChatMessage } from './llm'
import type { AgentEvent, RunAgentOptions, Tool } from './loop'
import { useAgentSettings } from './settings'

export interface RemoteAgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly messages: Ref<ChatMessage[]>
  readonly events: Ref<AgentEvent[]>
  load(scope?: string): Promise<void>
  send(userInput: string, options?: Partial<RunAgentOptions>): Promise<void>
  reset(): Promise<void>
  abort(): void
}

export interface RemoteAgentOptions {
  agentId: AgentId
  getScope(): string
  tools: Tool[]
  buildSystemPrompt(): string
  getContext?(): Record<string, unknown> | undefined
}

function createBridgeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function useRemoteAgent(options: RemoteAgentOptions): RemoteAgentSession {
  const service = useService(AgentServiceKey)
  const settings = useAgentSettings()
  const bridgeId = createBridgeId()
  const running = ref(false)
  const messages = shallowRef<ChatMessage[]>([])
  const events = shallowRef<AgentEvent[]>([])
  const abortControllers = new Map<string, AbortController>()
  const toolMap = new Map(options.tools.map(tool => [tool.name, tool]))
  let currentRunId = ''
  let currentScope = options.getScope()
  let streamingIndex = -1

  const bridgeReady = agentBridge.register({
    bridgeId,
    agentId: options.agentId,
    capabilities: options.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      readonly: tool.readonly,
      timeoutMs: tool.timeoutMs,
    })),
  })

  const stopToolRequest = agentBridge.onToolRequest(async (request: AgentToolRequest) => {
    if (request.bridgeId !== bridgeId) return
    const tool = toolMap.get(request.name)
    if (!tool) {
      await agentBridge.resolve({ bridgeId, callId: request.callId, error: `Unknown renderer tool: ${request.name}` })
      return
    }
    const controller = new AbortController()
    abortControllers.set(request.callId, controller)
    try {
      const result = await tool.execute(request.arguments, controller.signal)
      await agentBridge.resolve({ bridgeId, callId: request.callId, result })
    } catch (error) {
      await agentBridge.resolve({
        bridgeId,
        callId: request.callId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      abortControllers.delete(request.callId)
    }
  })

  const stopToolCancel = agentBridge.onToolCancel((request) => {
    if (request.bridgeId === bridgeId) abortControllers.get(request.callId)?.abort()
  })

  function applyRunEvent(event: RuntimeRunEvent) {
    if (event.runId !== currentRunId) {
      if (!currentRunId && running.value) currentRunId = event.runId
      else return
    }
    if (event.type === 'message_delta' && event.message) {
      const message = fromRuntimeMessage(event.message)
      if (message.role !== 'assistant') return
      if (streamingIndex < 0) {
        streamingIndex = messages.value.length
        messages.value = [...messages.value, message]
      } else {
        const next = messages.value.slice()
        next[streamingIndex] = message
        messages.value = next
      }
      return
    }
    if (event.type === 'message_end' && event.message) {
      const message = fromRuntimeMessage(event.message)
      if (streamingIndex >= 0 && message.role === 'assistant') {
        const next = messages.value.slice()
        next[streamingIndex] = message
        messages.value = next
      } else {
        messages.value = [...messages.value, message]
      }
      streamingIndex = -1
      return
    }
    if (event.type === 'tool_start' && event.toolCall) {
      events.value = [...events.value, { type: 'tool_call', toolCall: event.toolCall }]
      return
    }
    if (event.type === 'tool_end' && event.toolResult) {
      events.value = [...events.value, { type: 'tool_result', toolResult: event.toolResult }]
      return
    }
    if (event.type === 'error') {
      running.value = false
      events.value = [...events.value, { type: 'error', error: event.error }]
      return
    }
    if (event.type === 'complete') {
      running.value = false
      events.value = [...events.value, { type: 'done' }]
    }
  }

  const stopRunEvent = agentBridge.onRunEvent(applyRunEvent)

  function key(scope = currentScope): AgentConversationKey {
    return { agentId: options.agentId, scope }
  }

  async function load(scope = options.getScope()) {
    if (running.value) return
    currentScope = scope
    currentRunId = ''
    streamingIndex = -1
    events.value = []
    const conversation = await service.getConversation(key(scope))
    messages.value = conversation.messages.map(fromRuntimeMessage)
  }

  async function send(userInput: string, runOptions: Partial<RunAgentOptions> = {}) {
    if (running.value) throw new Error('Agent: a request is already in flight')
    await Promise.all([bridgeReady, settings.ready])
    if (!settings.configured.value) throw new Error('Agent: API key is not configured (Settings -> General -> AI Agent)')
    const scope = options.getScope()
    if (scope !== currentScope) await load(scope)
    running.value = true
    currentRunId = ''
    streamingIndex = -1
    messages.value = [...messages.value, { role: 'user', content: userInput }]
    try {
      const result = await service.startRun({
        key: key(scope),
        bridgeId,
        input: userInput,
        systemPrompt: options.buildSystemPrompt(),
        context: options.getContext?.(),
        policy: { maxTurns: runOptions.maxIterations ?? 10 },
      })
      currentRunId = result.runId
    } catch (error) {
      running.value = false
      throw error
    }
  }

  async function reset() {
    if (currentRunId) await service.cancelRun(currentRunId)
    await service.resetConversation(key(options.getScope()))
    currentRunId = ''
    streamingIndex = -1
    running.value = false
    messages.value = []
    events.value = []
  }

  function abort() {
    if (currentRunId) void service.cancelRun(currentRunId)
  }

  onUnmounted(() => {
    stopRunEvent()
    stopToolRequest()
    stopToolCancel()
    void agentBridge.unregister(bridgeId)
  })

  const available = computed(() => settings.configured.value && !!settings.resolvedEndpoint.value && !!settings.resolvedModel.value)
  return { available, running, messages, events, load, send, reset, abort }
}
