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
import { selectPendingRunEvents } from './projection'
import { useAgentSettings } from './settings'

export interface RemoteAgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly runError: Ref<string>
  readonly messages: Ref<AgentMessage[]>
  readonly events: Ref<AgentRunEvent[]>
  load(scope?: string): Promise<void>
  send(userInput: string): Promise<void>
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
  const runError = ref('')
  const messages = shallowRef<AgentMessage[]>([])
  const events = shallowRef<AgentRunEvent[]>([])
  let currentRunId = ''
  let currentScope = options.getScope()
  let streamingIndex = -1
  let lastEventSeq = 0
  let attachVersion = 0
  let bufferedEvents: AgentRunEvent[] | undefined
  let pendingLoad: Promise<void> = Promise.resolve()

  const bridgeReady = agentBridge.register({ bridgeId, agentId: options.agentId })
  const stopUiRequest = agentBridge.onUiRequest(async (request: AgentUiRequest) => {
    if (request.bridgeId !== bridgeId) return
    try {
      await agentBridge.resolve({ bridgeId, callId: request.callId, result: await options.handleUi(request.input) })
    } catch (error) {
      await agentBridge.resolve({ bridgeId, callId: request.callId, error: error instanceof Error ? error.message : String(error) })
    }
  })
  function applyRunEvent(event: AgentRunEvent) {
    if (event.runId !== currentRunId || event.seq <= lastEventSeq) return
    lastEventSeq = event.seq
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
    if (event.type === 'error') runError.value = event.error ?? ''
    if (event.type === 'complete' || event.type === 'error') running.value = false
  }
  const stopRunEvent = agentBridge.onRunEvent((event) => {
    if (bufferedEvents) bufferedEvents.push(event)
    else applyRunEvent(event)
  })

  const key = (scope = currentScope): AgentConversationKey => ({ agentId: options.agentId, scope })
  function replayBufferedEvents(buffer: AgentRunEvent[]) {
    for (const event of selectPendingRunEvents(buffer, currentRunId, lastEventSeq)) applyRunEvent(event)
  }
  async function attach(scope: string, version: number) {
    await bridgeReady
    if (running.value) return
    const buffer: AgentRunEvent[] = []
    bufferedEvents = buffer
    try {
      const attachment = await service.attachConversation(key(scope), bridgeId)
      if (version !== attachVersion) return
      currentScope = scope
      currentRunId = attachment.run?.runId ?? ''
      lastEventSeq = attachment.run?.eventSeq ?? 0
      streamingIndex = -1
      events.value = []
      runError.value = attachment.run?.error ?? ''
      running.value = attachment.run?.state === 'running'
      messages.value = attachment.conversation.messages
      if (bufferedEvents === buffer) bufferedEvents = undefined
      replayBufferedEvents(buffer)
    } finally {
      if (version === attachVersion && bufferedEvents === buffer) bufferedEvents = undefined
    }
  }
  function load(scope = options.getScope()) {
    const version = ++attachVersion
    const task = attach(scope, version)
    pendingLoad = task.catch(() => undefined)
    return task
  }
  async function send(input: string) {
    await Promise.all([bridgeReady, settings.ready, pendingLoad])
    if (running.value) throw new Error('Agent: a request is already in flight')
    if (!settings.configured.value) throw new Error('Agent: API key is not configured')
    const scope = options.getScope()
    if (scope !== currentScope) await load(scope)
    if (running.value) throw new Error('Agent: a request is already in flight')
    running.value = true
    currentRunId = ''
    streamingIndex = -1
    events.value = []
    runError.value = ''
    messages.value = [...messages.value, { role: 'user', content: input }]
    const buffer: AgentRunEvent[] = []
    bufferedEvents = buffer
    try {
      currentRunId = (await service.startRun({
        key: key(scope),
        bridgeId,
        input,
        locale: options.getLocale(),
        userId: options.getUserId?.(),
      })).runId
      if (bufferedEvents === buffer) bufferedEvents = undefined
      replayBufferedEvents(buffer)
    } catch (error) {
      if (bufferedEvents === buffer) bufferedEvents = undefined
      running.value = false
      throw error
    }
  }
  async function reset() {
    await pendingLoad
    if (currentRunId) await service.cancelRun(currentRunId)
    await service.resetConversation(key())
    attachVersion++
    bufferedEvents = undefined
    currentRunId = ''
    lastEventSeq = 0
    streamingIndex = -1
    messages.value = []
    events.value = []
    runError.value = ''
    running.value = false
  }
  const abort = () => {
    if (currentRunId) void service.cancelRun(currentRunId)
  }
  onUnmounted(() => {
    attachVersion++
    bufferedEvents = undefined
    stopRunEvent()
    stopUiRequest()
    void agentBridge.unregister(bridgeId)
  })
  return {
    available: computed(() => settings.configured.value),
    running,
    runError,
    messages,
    events,
    load,
    send,
    reset,
    abort,
  }
}
