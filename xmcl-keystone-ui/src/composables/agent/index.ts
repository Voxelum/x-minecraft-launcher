import { kInstance } from '../instance'
import { kInstanceJava } from '../instanceJava'
import { kInstanceLaunch } from '../instanceLaunch'
import { kInstanceModsContext } from '../instanceMods'
import { kInstanceOptions } from '../instanceOptions'
import { kInstanceResourcePacks } from '../instanceResourcePack'
import { kInstanceSave } from '../instanceSave'
import { kInstanceShaderPacks } from '../instanceShaderPack'
import { kInstanceVersion } from '../instanceVersion'
import { kInstanceVersionInstall } from '../instanceVersionInstall'
import { kInstances } from '../instances'
import { kUserContext } from '../user'
import { injection } from '@/util/inject'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from './llm'
import { runAgent, type AgentEvent, type RunAgentOptions } from './loop'
import type { AgentContext } from './tools'
import { buildSystemPrompt, createXmclTools } from './tools'
import { useAgentSettings } from './settings'
import {
  buildChangeEvent,
  renderSessionContext,
  snapshotJava,
  snapshotVersion,
  trimRuntime,
  type SessionContext,
} from './context'

export * from './llm'
export * from './loop'
export * from './tools'
export * from './context'

export interface AgentSession {
  /**
   * Reactive — flips to `true` as soon as an API key is configured (e.g. via
   * Settings -> General -> AI Agent) without requiring an app restart.
   */
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly messages: Ref<ChatMessage[]>
  readonly events: Ref<AgentEvent[]>
  loadConversationForCurrentInstance(): void
  send(userInput: string, options?: Partial<RunAgentOptions>): Promise<void>
  reset(): void
  abort(): void
}

interface StoredAgentConversation {
  messages: ChatMessage[]
  snapshot?: SessionContext
  updatedAt: number
}

interface StoredAgentConversationStore {
  version: 1
  byInstance: Record<string, StoredAgentConversation>
}

const AGENT_CONVERSATION_STORAGE_KEY = 'agentConversationByInstanceV1'
const MAX_STORED_MESSAGES = 120

/**
 * Build an agent session bound to the current launcher state. Must be called
 * inside a component setup — depends on `provide`d instance / mods / launch
 * composables. The session is independent of the Vue component lifecycle:
 * `abort()` cancels the in-flight LLM/tool request.
 */
export function useAgent(): AgentSession {
  const router = useRouter()
  const { instance } = injection(kInstance)
  const { instances, selectedInstance } = injection(kInstances)
  const { resolvedVersion } = injection(kInstanceVersion)
  const { instruction: installInstruction, fix: fixInstanceInstall } = injection(kInstanceVersionInstall)
  const { java, status: javaStatus } = injection(kInstanceJava)
  const { mods } = injection(kInstanceModsContext)
  const { enabled: rpEnabled, disabled: rpDisabled, enable: enableRP, disable: disableRP } = injection(kInstanceResourcePacks)
  const { shaderPacks, shaderPack: selectedShaderPack } = injection(kInstanceShaderPacks)
  const { saves } = injection(kInstanceSave)
  const { gameOptions } = injection(kInstanceOptions)
  const { userProfile } = injection(kUserContext)
  const { launch, kill } = injection(kInstanceLaunch)
  const agentSettings = useAgentSettings()

  const resourcePacks = computed(() => [...rpEnabled.value, ...rpDisabled.value])
  const shaderPackName = computed({
    get: () => selectedShaderPack.value ?? '',
    set: (v: string) => { selectedShaderPack.value = v || undefined },
  })

  const ctx: AgentContext = {
    router,
    instance,
    instances,
    selectedInstancePath: selectedInstance,
    resolvedVersion,
    javaStatus,
    java,
    userProfile,
    mods,
    resourcePacks,
    shaderPacks,
    selectedShaderPack: shaderPackName,
    saves,
    gameOptions,
    installInstruction,
    fixInstanceInstall: () => fixInstanceInstall(),
    enableResourcePack: (packs) => enableRP(packs as any),
    disableResourcePack: (packs) => disableRP(packs),
    selectShaderPack: (fileName) => { selectedShaderPack.value = fileName },
    launch: () => launch(),
    killGame: (side, force) => kill(side, force),
  }

  const registry = createXmclTools(ctx)
  const { locale } = useI18n()

  const running = ref(false)
  const messages = shallowRef<ChatMessage[]>([])
  const events = shallowRef<AgentEvent[]>([])
  let abortCtrl: AbortController | undefined
  /** Snapshot frozen on first user message in the current session. */
  let sessionSnapshot: SessionContext | undefined
  /** Stop watcher for resolved-version / java drift. Disposed on reset. */
  let stopDriftWatch: (() => void) | undefined

  function currentInstancePath(): string | undefined {
    return selectedInstance.value || instance.value.path || undefined
  }

  function readConversationStore(): StoredAgentConversationStore {
    try {
      const raw = localStorage.getItem(AGENT_CONVERSATION_STORAGE_KEY)
      if (!raw) return { version: 1, byInstance: {} }
      const parsed = JSON.parse(raw) as StoredAgentConversationStore
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !parsed.byInstance || typeof parsed.byInstance !== 'object') {
        return { version: 1, byInstance: {} }
      }
      return parsed
    } catch {
      return { version: 1, byInstance: {} }
    }
  }

  function writeConversationStore(store: StoredAgentConversationStore) {
    try {
      localStorage.setItem(AGENT_CONVERSATION_STORAGE_KEY, JSON.stringify(store))
    } catch {
      // Ignore quota / serialization failures. Conversation persistence is
      // best-effort and should never block the agent UX.
    }
  }

  function trimMessagesForStore(input: ChatMessage[]): ChatMessage[] {
    if (input.length <= MAX_STORED_MESSAGES) return input
    const sys = input.find((m) => m.role === 'system')
    const nonSystem = input.filter((m) => m.role !== 'system')
    const tail = nonSystem.slice(-(MAX_STORED_MESSAGES - (sys ? 1 : 0)))
    return sys ? [sys, ...tail] : tail
  }

  function persistCurrentConversation() {
    const path = currentInstancePath()
    if (!path) return
    const store = readConversationStore()
    if (messages.value.length === 0) {
      delete store.byInstance[path]
      writeConversationStore(store)
      return
    }
    store.byInstance[path] = {
      messages: trimMessagesForStore(messages.value),
      snapshot: sessionSnapshot,
      updatedAt: Date.now(),
    }
    writeConversationStore(store)
  }

  function loadConversationForCurrentInstance() {
    if (running.value) return
    const path = currentInstancePath()
    stopDriftWatch?.()
    stopDriftWatch = undefined
    events.value = []
    sessionSnapshot = undefined
    if (!path) {
      messages.value = []
      return
    }

    const store = readConversationStore()
    const saved = store.byInstance[path]
    if (!saved || !Array.isArray(saved.messages)) {
      messages.value = []
      return
    }

    messages.value = saved.messages.slice()
    sessionSnapshot = saved.snapshot
    // Backward compatibility: if an old persisted conversation has a system
    // message but no snapshot metadata, regenerate one so we can continue.
    if (!sessionSnapshot && saved.messages.some((m) => m.role === 'system')) {
      sessionSnapshot = captureSnapshot()
    }
    if (sessionSnapshot) {
      startDriftWatch()
    }
  }

  function captureSnapshot(): SessionContext {
    const inst = instance.value
    const profile = userProfile.value
    const profileEntry = profile?.profiles?.[profile.selectedProfile]
    const rt = trimRuntime(inst.runtime)
    const ver = snapshotVersion(resolvedVersion.value)
    const jv = snapshotJava(javaStatus.value)
    return {
      locale: locale.value,
      username: profileEntry?.name || profile?.username || '<no user>',
      userType: profile?.authority || 'offline',
      instancePath: inst.path || '<no instance>',
      instanceName: inst.name || '<unnamed>',
      runtime: rt,
      side: inst.server ? 'server' : 'client',
      resolvedVersion: ver,
      resolvedJava: jv,
      fileTree: {
        modsTotal: mods.value.length,
        modsEnabled: mods.value.filter((m) => m.enabled).length,
        resourcePacksTotal: resourcePacks.value.length,
        resourcePacksEnabled: resourcePacks.value.filter((p) => p.enabled).length,
        shaderPacksTotal: shaderPacks.value.length,
        shaderSelected: shaderPackName.value || undefined,
        savesTotal: saves.value.length,
        logsTotal: 0,
        crashReportsTotal: 0,
      },
    }
  }

  function startDriftWatch() {
    stopDriftWatch?.()
    stopDriftWatch = watch(
      [resolvedVersion, javaStatus, selectedInstance],
      ([v, j, p]) => {
        if (!sessionSnapshot) return
        const change = {
          resolvedVersion: snapshotVersion(v),
          resolvedJava: snapshotJava(j),
          instancePath: p,
        }
        const evt = buildChangeEvent(sessionSnapshot, change)
        if (!evt) return
        // Mutate the snapshot in place so subsequent drift events compare
        // against the latest known state, not the original session start.
        sessionSnapshot = {
          ...sessionSnapshot,
          ...change,
        }
        messages.value = [
          ...messages.value,
          { role: 'user', content: evt },
        ]
        persistCurrentConversation()
      },
      { deep: true },
    )
  }

  async function send(userInput: string, options: Partial<RunAgentOptions> = {}) {
    if (running.value) throw new Error('Agent: a request is already in flight')
    if (!agentSettings.apiKey.value.trim()) {
      throw new Error('Agent: API key is not configured (Settings -> General -> AI Agent)')
    }

    // First user turn freezes the session snapshot so the prompt stays stable.
    if (!sessionSnapshot) {
      sessionSnapshot = captureSnapshot()
      const sys = buildSystemPrompt({
        locale: sessionSnapshot.locale,
        sessionContextMarkdown: renderSessionContext(sessionSnapshot),
        loadable: registry.loadable,
      })
      messages.value = [{ role: 'system', content: sys }]
      startDriftWatch()
      persistCurrentConversation()
    }

    running.value = true
    abortCtrl = new AbortController()
    const history = messages.value.slice()
    history.push({ role: 'user', content: userInput })
    // Publish the in-flight transcript immediately so the chat UI shows
    // the user message and subsequent assistant/tool turns live.
    messages.value = history.slice()
    try {
      await runAgent(history, {
        apiKey: agentSettings.apiKey.value.trim(),
        endpoint: agentSettings.resolvedEndpoint.value,
        model: agentSettings.resolvedModel.value,
        ...options,
        tools: registry.base,
        loadable: registry.loadable,
        signal: abortCtrl.signal,
        onEvent: (e) => {
          events.value = [...events.value, e]
          // `runAgent` mutates `history` in place. `messages` is a shallowRef,
          // so we must hand it a NEW array reference each event — reassigning
          // the same `history` reference would be a no-op and the assistant /
          // tool bubbles would never re-render.
          messages.value = history.slice()
          persistCurrentConversation()
          options.onEvent?.(e)
        },
      })
      messages.value = history.slice()
      persistCurrentConversation()
    } finally {
      running.value = false
      abortCtrl = undefined
    }
  }

  function reset() {
    if (running.value) abortCtrl?.abort()
    stopDriftWatch?.()
    stopDriftWatch = undefined
    sessionSnapshot = undefined
    messages.value = []
    events.value = []
    persistCurrentConversation()
  }

  function abort() {
    abortCtrl?.abort()
  }

  // "Configured" requires all three fields (key, endpoint, model) to be
  // present and non-empty. Any null/empty value means the agent is not ready.
  const available = computed(() =>
    !!(agentSettings.apiKey.value || '').trim() &&
    !!(agentSettings.endpoint.value || '').trim() &&
    !!(agentSettings.model.value || '').trim())

  return {
    available,
    running,
    messages,
    events,
    loadConversationForCurrentInstance,
    send,
    reset,
    abort,
  }
}

export const kAgent: InjectionKey<AgentSession> = Symbol('Agent')

/**
 * Install a small dev hook on `window` so the agent can be poked from
 * DevTools without any UI shipped yet. Logged once per app boot when the key
 * is present so contributors notice the surface.
 */
export function installAgentDevLauncher(session: AgentSession) {
  if (!session.available.value) {
    console.info('[agent] disabled (AGNES_API_KEY missing)')
    return
  }
  ;(window as any).__xmcl_agent = {
    send: (input: string) => session.send(input).catch((e) => console.error('[agent]', e)),
    reset: () => session.reset(),
    abort: () => session.abort(),
    get running() { return session.running.value },
    get messages() { return session.messages.value },
    get events() { return session.events.value },
  }
  console.info('[agent] ready — try window.__xmcl_agent.send("list my mods")')
}
