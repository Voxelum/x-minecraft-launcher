import {
  AgentServiceKey,
  type AgentConversationKey,
  type AgentId,
  type AgentMessage,
  type AgentRunEvent,
  type AgentUiAction,
  type AgentUiRequest,
} from '@xmcl/runtime-api'
import { computed, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useService } from '../service'
import { useAgentSettings } from './settings'

export interface RemoteAgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly messages: Ref<AgentMessage[]>
  readonly events: Ref<AgentRunEvent[]>
  load(scope?: string): Promise<void>
  send(userInput: string, options?: { maxTurns?: number }): Promise<void>
  reset(): Promise<void>
  abort(): void
}

export interface RemoteAgentOptions {
  agentId: AgentId
  getScope(): string
  getLocale(): string
  getUserId?(): string | undefined
  handleUi(input: AgentUiAction): Promise<unknown>
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
  const messages = shallowRef<AgentMessage[]>([])
  const events = shallowRef<AgentRunEvent[]>([])
  let currentRunId = ''
  let currentScope = options.getScope()
  let streamingIndex = -1

  const bridgeReady = agentBridge.register({ bridgeId, agentId: options.agentId })
  const stopUiRequest = agentBridge.onUiRequest(async (request: AgentUiRequest) => {
    if (request.bridgeId !== bridgeId) return
    try {
      await agentBridge.resolve({ bridgeId, callId: request.callId, result: await options.handleUi(request.input) })
    } catch (error) {
      await agentBridge.resolve({ bridgeId, callId: request.callId, error: error instanceof Error ? error.message : String(error) })
    }
  })
  const stopRunEvent = agentBridge.onRunEvent((event) => {
    if (event.runId !== currentRunId) {
      if (!currentRunId && running.value) currentRunId = event.runId
      else return
    }
    events.value = [...events.value, event]
    if ((event.type === 'message_delta' || event.type === 'message_end') && event.message) {
      if (event.type === 'message_delta' && event.message.role === 'assistant') {
        if (streamingIndex < 0) {
          streamingIndex = messages.value.length
          messages.value = [...messages.value, event.message]
        } else {
          const next = messages.value.slice()
          next[streamingIndex] = event.message
          messages.value = next
        }
      } else if (streamingIndex >= 0 && event.message.role === 'assistant') {
        const next = messages.value.slice()
        next[streamingIndex] = event.message
        messages.value = next
        streamingIndex = -1
      } else {
        messages.value = [...messages.value, event.message]
      }
    }
    if (event.type === 'complete' || event.type === 'error') running.value = false
  })

  const key = (scope = currentScope): AgentConversationKey => ({ agentId: options.agentId, scope })
  async function load(scope = options.getScope()) {
    if (running.value) return
    currentScope = scope
    currentRunId = ''
    streamingIndex = -1
    events.value = []
    messages.value = (await service.getConversation(key(scope))).messages
  }
  async function send(input: string, runOptions: { maxTurns?: number } = {}) {
    if (running.value) throw new Error('Agent: a request is already in flight')
    await Promise.all([bridgeReady, settings.ready])
    if (!settings.configured.value) throw new Error('Agent: API key is not configured')
    const scope = options.getScope()
    if (scope !== currentScope) await load(scope)
    running.value = true
    currentRunId = ''
    messages.value = [...messages.value, { role: 'user', content: input }]
    try {
      currentRunId = (await service.startRun({
        key: key(scope),
        bridgeId,
        input,
        locale: options.getLocale(),
        userId: options.getUserId?.(),
        policy: { maxTurns: runOptions.maxTurns ?? 10 },
      })).runId
    } catch (error) {
      running.value = false
      throw error
    }
  }
  async function reset() {
    if (currentRunId) await service.cancelRun(currentRunId)
    await service.resetConversation(key(options.getScope()))
    currentRunId = ''
    messages.value = []
    events.value = []
    running.value = false
  }
  const abort = () => {
    if (currentRunId) void service.cancelRun(currentRunId)
  }
  onUnmounted(() => {
    stopRunEvent()
    stopUiRequest()
    void agentBridge.unregister(bridgeId)
  })
  return {
    available: computed(() => settings.configured.value),
    running,
    messages,
    events,
    load,
    send,
    reset,
    abort,
  }
}
