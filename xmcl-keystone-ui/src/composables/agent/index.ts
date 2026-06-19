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
import { useInstanceVersionServerInstall } from '../instanceVersionServerInstall'
import { kInstances } from '../instances'
import { kUserContext } from '../user'
import { kModDependenciesCheck } from '../modDependenciesCheck'
import { kModLibCleaner } from '../modLibCleaner'
import { kModUpgrade } from '../modUpgrade'
import { kJavaContext } from '../java'
import { kInstanceJavaDiagnose } from '../instanceJavaDiagnose'
import { useService } from '../service'
import { InstanceInstallServiceKey, InstanceModsServiceKey, InstanceOptionsServiceKey, JavaServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { getInstanceFileFromModrinthVersion } from '@/util/modrinth'
import { getModSide } from '@/util/mod'
import type { InstanceFile } from '@xmcl/instance'
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
export * from './cssAgent'

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
  /** Lazy tool packs loaded during this conversation, re-mounted on resume. */
  loadedPacks?: string[]
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
  const { resolvedVersion, serverVersionId } = injection(kInstanceVersion)
  const { instruction: installInstruction, fix: fixInstanceInstall } = injection(kInstanceVersionInstall)
  const { java, status: javaStatus } = injection(kInstanceJava)
  const { mods } = injection(kInstanceModsContext)
  const { enabled: rpEnabled, disabled: rpDisabled, enable: enableRP, disable: disableRP } = injection(kInstanceResourcePacks)
  const { shaderPacks, shaderPack: selectedShaderPack } = injection(kInstanceShaderPacks)
  const { saves } = injection(kInstanceSave)
  const { gameOptions } = injection(kInstanceOptions)
  const { userProfile, users, select: selectAccount } = injection(kUserContext)
  const { launch, kill, serverCount } = injection(kInstanceLaunch)
  const depCheck = injection(kModDependenciesCheck)
  const libCleaner = injection(kModLibCleaner)
  const modUpgrade = injection(kModUpgrade)
  const { all: javaList, refresh: refreshJavaList } = injection(kJavaContext)
  const { issue: javaIssue } = injection(kInstanceJavaDiagnose)
  const instanceInstall = useService(InstanceInstallServiceKey)
  const instanceMods = useService(InstanceModsServiceKey)
  const instanceOptions = useService(InstanceOptionsServiceKey)
  const javaService = useService(JavaServiceKey)
  const versionService = useService(VersionServiceKey)
  const { install: installServerVersion } = useInstanceVersionServerInstall()
  const agentSettings = useAgentSettings()

  const resourcePacks = computed(() => [...rpEnabled.value, ...rpDisabled.value])
  const shaderPackName = computed({
    get: () => selectedShaderPack.value ?? '',
    set: (v: string) => { selectedShaderPack.value = v || undefined },
  })

  function genOpId() {
    return crypto.getRandomValues(new Uint8Array(8)).join('')
  }

  async function checkModDependencies() {
    await depCheck.refresh()
    const missing = depCheck.installation.value.map(([file, mod]) => ({
      file: file.path,
      requiredBy: mod.name || mod.fileName,
    }))
    const err = depCheck.error.value
    return { missing, ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}) }
  }

  async function installModDependencies() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const files = depCheck.installation.value.map(([f]) => f)
    if (!files.length) return { installed: 0, note: 'No missing dependencies. Run check_mod_dependencies first.' }
    await instanceInstall.installInstanceFiles({ path, oldFiles: [], files, id: genOpId() })
    return { installed: files.length, files: files.map((f) => f.path) }
  }

  async function scanUnusedMods() {
    await libCleaner.refresh()
    const unused = libCleaner.unusedMods.value.map((f) => ({ path: f.path }))
    const err = libCleaner.error.value
    return { unused, ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}) }
  }

  async function disableUnusedMods() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const oldFiles = libCleaner.unusedMods.value
    if (!oldFiles.length) return { disabled: 0, note: 'No unused library mods. Run scan_unused_mods first.' }
    const files = oldFiles.map((f) => ({ ...f, path: f.path + '.disabled' }))
    await instanceInstall.installInstanceFiles({ path, oldFiles, files, id: genOpId() })
    return { disabled: oldFiles.length, files: oldFiles.map((f) => f.path) }
  }

  function normalizeUpgradePolicy(policy?: string): 'curseforge' | 'modrinth' | 'curseforgeOnly' | 'modrinthOnly' {
    const candidate = policy ?? String(modUpgrade.upgradePolicy.value)
    if (candidate === 'curseforge' || candidate === 'curseforgeOnly' || candidate === 'modrinthOnly') {
      return candidate
    }
    return 'modrinth'
  }

  async function checkModUpdates(opts: { policy?: string; skipVersion?: boolean }) {
    const policy = normalizeUpgradePolicy(opts.policy)
    const skipVersion = opts.skipVersion ?? modUpgrade.skipVersion.value
    await modUpgrade.refresh({ policy, skipVersion })
    const updates = Object.values(modUpgrade.plans.value).map((p) => ({
      mod: p.mod.name || p.mod.fileName,
      from: p.mod.version,
      to: 'version' in p ? (p.version.version_number || p.version.name) : (p.file.displayName || p.file.fileName),
      source: 'version' in p ? 'modrinth' : 'curseforge',
    }))
    const err = modUpgrade.error.value
    return { updates, ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}) }
  }

  async function applyModUpdates() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const plans = Object.values(modUpgrade.plans.value)
    if (!plans.length) return { upgraded: 0, note: 'No updates available. Run check_mod_updates first.' }
    const oldFiles: InstanceFile[] = []
    const files: InstanceFile[] = []
    for (const plan of plans) {
      oldFiles.push({
        path: `mods/${plan.mod.fileName}`,
        hashes: { sha1: plan.mod.hash },
        size: plan.mod.size || 0,
      })
      files.push('file' in plan
        ? getInstanceFileFromCurseforgeFile(plan.file)
        : getInstanceFileFromModrinthVersion(plan.version))
    }
    await instanceInstall.installInstanceFiles({ path, oldFiles, files, id: genOpId() })
    return { upgraded: plans.length, mods: plans.map((p) => p.mod.name || p.mod.fileName) }
  }

  async function installJava() {
    const required = javaStatus.value?.javaVersion
    const installed = await javaService.installJava(required)
    await refreshJavaList(true).catch(() => undefined)
    return {
      ok: true,
      requiredMajorVersion: required?.majorVersion,
      path: installed.path,
      version: installed.version,
      majorVersion: installed.majorVersion,
    }
  }

  // ── Local server ──────────────────────────────────────────────────────

  /**
   * The server version id installed during this session. Kept because the
   * reactive `serverVersionId` (derived by matching the synced server list
   * against the instance runtime) can miss right after an install — the inner
   * install fires `refreshServerVersion` without awaiting, and a parsed server
   * profile whose `minecraft` differs from the runtime never matches. We use it
   * as an authoritative fallback, verified against disk.
   */
  let installedServerVersion: string | undefined

  /** Enabled mods that are not client-only, i.e. safe to deploy to a server. */
  function serverFitMods() {
    const rt = instance.value.runtime
    const loader = rt.neoForged ? 'neoforge' : rt.forge ? 'forge' : rt.quiltLoader ? 'quilt' : 'fabric'
    return mods.value.filter((m) => m.enabled && getModSide(m, loader) !== 'CLIENT')
  }

  async function installServer() {
    if (!currentInstancePath()) return { error: 'no instance selected' }
    const version = await installServerVersion()
    installedServerVersion = version || installedServerVersion
    // The inner install calls refreshServerVersion fire-and-forget; await it
    // here so the reactive server list (and serverVersionId) catches up.
    if (version) await versionService.refreshServerVersion(version).catch(() => undefined)
    return { ok: true, version }
  }

  /** True if `id` resolves to an installed server version on disk. */
  async function serverVersionResolves(id: string | undefined): Promise<boolean> {
    if (!id) return false
    return versionService.resolveServerVersion(id).then(() => true, () => false)
  }

  async function getServerStatus() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const [eula, properties, deployed] = await Promise.all([
      instanceOptions.getEULA(path).catch(() => false),
      instanceOptions.getServerProperties(path).catch(() => ({} as Record<string, string>)),
      instanceMods.getServerInstanceMods(path).catch(() => [] as Array<{ fileName: string; ino: number }>),
    ])
    // Prefer the reactive match; fall back to the id we installed this session,
    // verified against disk, so a stale/missed match doesn't report a real
    // server as "not installed".
    let version = serverVersionId.value || undefined
    let installed = !!version
    if (!installed && await serverVersionResolves(installedServerVersion)) {
      installed = true
      version = installedServerVersion
    }
    return {
      installed,
      serverVersion: version ?? null,
      running: serverCount.value,
      eula,
      properties,
      deployedMods: deployed.map((d) => d.fileName),
    }
  }

  async function setServerEula(accepted: boolean) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    await instanceOptions.setEULA(path, accepted)
    return { ok: true, eula: accepted }
  }

  async function setServerProperties(props: Record<string, string | number | boolean>) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    await instanceOptions.setServerProperties(path, props)
    const properties = await instanceOptions.getServerProperties(path).catch(() => ({} as Record<string, string>))
    return { ok: true, properties }
  }

  async function deployServerMods(paths?: string[]) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const files = paths && paths.length ? paths : serverFitMods().map((m) => m.path)
    if (!files.length) return { deployed: 0, note: 'No server-compatible enabled mods to deploy.' }
    await instanceMods.installToServerInstance({ path, files })
    return { ok: true, deployed: files.length, files }
  }

  async function setServerFile(file: string, content: string) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    try {
      await instanceOptions.setServerFile(path, file, content)
      return { ok: true, file }
    } catch (e) {
      return { error: `cannot write server/${file}: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  async function launchServer(opts?: { nogui?: boolean }) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const eula = await instanceOptions.getEULA(path).catch(() => false)
    if (!eula) {
      return { error: 'EULA not accepted. The user must agree to the Minecraft EULA (https://aka.ms/MinecraftEULA); call set_server_eula({ accepted: true }) once they do, then launch again.' }
    }
    let version = serverVersionId.value || installedServerVersion
    if (!await serverVersionResolves(version)) {
      version = await installServerVersion()
      installedServerVersion = version || installedServerVersion
    }
    const before = serverCount.value
    try {
      await launch('server', { nogui: opts?.nogui, version })
    } catch (e) {
      return { ok: false, version, error: `failed to start server: ${e instanceof Error ? e.message : String(e)}` }
    }
    // `launch` only spawns the JVM and returns; a broken/incomplete install
    // (e.g. a missing forge shim jar) makes the server exit within a second, so
    // a bare `ok: true` would be a lie. Watch the live server-process count
    // briefly and report the real outcome.
    let exited = false
    for (let i = 0; i < 8 && !exited; i++) {
      await new Promise<void>((r) => setTimeout(r, 400))
      if (serverCount.value <= before) exited = true
    }
    if (exited) {
      return {
        ok: false,
        version,
        error: 'The server process exited right after launching — the install is likely incomplete or broken (e.g. a missing jar). Read the newest entry under launch-failures/ (or the server logs/) with vfs_read to get the exact error, then reinstall or repair the server before trying again.',
      }
    }
    return { ok: true, version }
  }

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
    checkModDependencies,
    installModDependencies,
    scanUnusedMods,
    disableUnusedMods,
    checkModUpdates,
    applyModUpdates,
    javaList,
    javaIssue,
    installJava,
    getServerStatus,
    installServer,
    setServerEula,
    setServerProperties,
    deployServerMods,
    launchServer,
    setServerFile,
    accounts: users,
    selectAccount,
  }

  const registry = createXmclTools(ctx)
  const { locale } = useI18n()

  const running = ref(false)
  const messages = shallowRef<ChatMessage[]>([])
  const events = shallowRef<AgentEvent[]>([])
  let abortCtrl: AbortController | undefined
  /** Snapshot frozen on first user message in the current session. */
  let sessionSnapshot: SessionContext | undefined
  /**
   * Lazy tool packs loaded so far this session. Each `runAgent` call rebuilds
   * its tool map from the base set, so we re-mount these every turn (and across
   * reloads) — otherwise a tool loaded in an earlier turn becomes "unknown".
   */
  const loadedPacks = new Set<string>()
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
      loadedPacks: [...loadedPacks],
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
    loadedPacks.clear()
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
    for (const p of saved.loadedPacks ?? []) loadedPacks.add(p)
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
        preloadedPacks: [...loadedPacks],
        signal: abortCtrl.signal,
        onEvent: (e) => {
          // Remember packs loaded this turn so later turns (and reloads)
          // re-mount them instead of failing with "unknown tool".
          if (e.type === 'tools_loaded' && e.loaded) {
            for (const n of e.loaded) loadedPacks.add(n)
          }
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
    loadedPacks.clear()
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
    console.info('[agent] disabled (API key missing)')
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
