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
import { kModUpgrade, useModUpgrade } from '../modUpgrade'
import { kJavaContext } from '../java'
import { kInstanceJavaDiagnose } from '../instanceJavaDiagnose'
import { useService } from '../service'
import { InstanceInstallServiceKey, InstanceModsServiceKey, InstanceOptionsServiceKey, JavaServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { getModSide } from '@/util/mod'
import { injection } from '@/util/inject'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from './llm'
import { toRuntimeMessage } from './llm'
import { createModsCliOperations } from './cli/mods'
import { createPackUpdateOperations } from './cli/packs'
import { createInstanceChangeOperations } from './instanceChanges'
import type { AgentEvent, RunAgentOptions } from './loop'
import type { AgentContext } from './tools'
import { buildSystemPrompt, createXmclTools } from './tools'
import { useRemoteAgent } from './remote'
import { AgentServiceKey } from '@xmcl/runtime-api'
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
  loadConversationForCurrentInstance(): Promise<void>
  send(userInput: string, options?: Partial<RunAgentOptions>): Promise<void>
  reset(): Promise<void>
  abort(): void
}

interface StoredAgentConversationStore {
  version: 1
  byInstance: Record<string, { messages: ChatMessage[]; snapshot?: SessionContext; updatedAt: number }>
}

const AGENT_CONVERSATION_STORAGE_KEY = 'agentConversationByInstanceV1'

/**
 * Build an agent session bound to the current launcher state. Must be called
 * inside a component setup — depends on `provide`d instance / mods / launch
 * composables. The session is independent of the Vue component lifecycle:
 * `abort()` cancels the in-flight LLM/tool request.
 */
export function useAgent(): AgentSession {
  const router = useRouter()
  const { instance, path: instancePath, runtime } = injection(kInstance)
  const { instances, selectedInstance } = injection(kInstances)
  const { resolvedVersion, serverVersionId } = injection(kInstanceVersion)
  const { instruction: installInstruction, fix: fixInstanceInstall } = injection(kInstanceVersionInstall)
  const { java, status: javaStatus } = injection(kInstanceJava)
  const { mods } = injection(kInstanceModsContext)
  const { enabled: rpEnabled, disabled: rpDisabled, revalidate: revalidateResourcePacks } = injection(kInstanceResourcePacks)
  const { shaderPacks, shaderPack: selectedShaderPack, revalidate: revalidateShaderPacks } = injection(kInstanceShaderPacks)
  const { saves } = injection(kInstanceSave)
  const { gameOptions } = injection(kInstanceOptions)
  const { userProfile, users, select: selectAccount } = injection(kUserContext)
  const { launch, kill, serverCount, gameProcesses } = injection(kInstanceLaunch)
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
  const agentService = useService(AgentServiceKey)

  const resourcePacks = computed(() => [...rpEnabled.value, ...rpDisabled.value])
  const shaderPackName = computed(() => selectedShaderPack.value ?? '')
  const resourcePackUpgrade = useModUpgrade(instancePath, runtime, resourcePacks, revalidateResourcePacks, 'resourcepacks')
  const shaderPackUpgrade = useModUpgrade(instancePath, runtime, shaderPacks, revalidateShaderPacks, 'shaderpacks')

  async function installJava(options: { majorVersion?: number; component?: string; forceZulu?: boolean } = {}) {
    const required = javaStatus.value?.javaVersion
    const target = {
      majorVersion: options.majorVersion ?? required?.majorVersion ?? 8,
      component: options.component ?? required?.component ?? 'jre-legacy',
    }
    const installed = await javaService.installJava(target, options.forceZulu ?? false)
    await refreshJavaList(true).catch(() => undefined)
    return {
      ok: true,
      target,
      forceZulu: options.forceZulu ?? false,
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

  async function deployServerMods(paths?: string[]) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const files = paths && paths.length ? paths : serverFitMods().map((m) => m.path)
    if (!files.length) return { deployed: 0, note: 'No server-compatible enabled mods to deploy.' }
    await instanceMods.installToServerInstance({ path, files })
    return { ok: true, deployed: files.length, files }
  }

  async function launchServer(opts?: { nogui?: boolean }) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const eula = await instanceOptions.getEULA(path).catch(() => false)
    if (!eula) {
      return { error: 'EULA not accepted. The user must agree to the Minecraft EULA (https://aka.ms/MinecraftEULA); run `bash server eula accept` once they do, then launch again.' }
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

  async function launchForSide(side: 'client' | 'server' = 'client', opts?: { nogui?: boolean }) {
    if (side === 'server') return launchServer(opts)
    await launch()
    return { ok: true, side: 'client' }
  }

  const instanceChanges = createInstanceChangeOperations({ currentInstancePath, instanceInstall })
  const modMaintenance = createModsCliOperations({
    currentInstancePath,
    dependencyCheck: depCheck,
    libCleaner,
    modUpgrade,
    instanceChanges,
  })
  const packUpdates = {
    resourcepacks: createPackUpdateOperations({
      kind: 'resourcepacks',
      currentInstancePath,
      upgrade: resourcePackUpgrade,
      instanceChanges,
    }),
    shaderpacks: createPackUpdateOperations({
      kind: 'shaderpacks',
      currentInstancePath,
      upgrade: shaderPackUpgrade,
      instanceChanges,
    }),
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
    gameProcesses,
    saves,
    gameOptions,
    installInstruction,
    fixInstanceInstall: () => fixInstanceInstall(),
    launch: launchForSide,
    killGame: (side, force) => kill(side, force),
    modMaintenance,
    packUpdates,
    instanceChanges,
    javaList,
    javaIssue,
    installJava,
    getServerStatus,
    installServer,
    setServerEula,
    deployServerMods,
    accounts: users,
    selectAccount,
  }

  const registry = createXmclTools(ctx)
  const { locale } = useI18n()

  /** Snapshot frozen on first user message in the current session. */
  let sessionSnapshot: SessionContext | undefined
  let stopDriftWatch: (() => void) | undefined

  function currentInstancePath(): string | undefined {
    return selectedInstance.value || instance.value.path || undefined
  }

  async function migrateLegacyConversations() {
    const raw = localStorage.getItem(AGENT_CONVERSATION_STORAGE_KEY)
    if (!raw) return
    try {
      const store = JSON.parse(raw) as StoredAgentConversationStore
      if (store?.version !== 1 || !store.byInstance) return
      for (const [scope, saved] of Object.entries(store.byInstance)) {
        await agentService.importLegacyConversation({
          key: { agentId: 'launcher', scope },
          messages: saved.messages.map(toRuntimeMessage),
          context: saved.snapshot as unknown as Record<string, unknown>,
          updatedAt: saved.updatedAt,
        })
      }
      localStorage.removeItem(AGENT_CONVERSATION_STORAGE_KEY)
    } catch {
      // Preserve malformed or failed legacy data for manual recovery.
    }
  }

  void migrateLegacyConversations()

  async function loadConversationForCurrentInstance() {
    if (remote.running.value) return
    const path = currentInstancePath()
    stopDriftWatch?.()
    stopDriftWatch = undefined
    sessionSnapshot = undefined
    if (!path) {
      await remote.load('')
      return
    }
    const saved = await agentService.getConversation({ agentId: 'launcher', scope: path })
    sessionSnapshot = saved.context as unknown as SessionContext | undefined
    await remote.load(path)
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
        gameProcessesTotal: gameProcesses.value.length,
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
        void agentService.notifyContextChange({
          key: { agentId: 'launcher', scope: p },
          message: evt,
          context: sessionSnapshot as unknown as Record<string, unknown>,
        })
      },
      { deep: true },
    )
  }

  const remote = useRemoteAgent({
    agentId: 'launcher',
    getScope: () => currentInstancePath() ?? '',
    tools: registry.base,
    buildSystemPrompt: () => {
      if (!sessionSnapshot) {
        sessionSnapshot = captureSnapshot()
        startDriftWatch()
      }
      return buildSystemPrompt({
        locale: sessionSnapshot.locale,
        sessionContextMarkdown: renderSessionContext(sessionSnapshot),
      })
    },
    getContext: () => sessionSnapshot as unknown as Record<string, unknown> | undefined,
  })

  async function send(userInput: string, options: Partial<RunAgentOptions> = {}) {
    if (!sessionSnapshot) {
      sessionSnapshot = captureSnapshot()
      startDriftWatch()
    }
    await remote.send(userInput, options)
  }

  async function reset() {
    stopDriftWatch?.()
    stopDriftWatch = undefined
    sessionSnapshot = undefined
    await remote.reset()
  }

  function abort() {
    remote.abort()
  }

  return {
    available: remote.available,
    running: remote.running,
    messages: remote.messages,
    events: remote.events,
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
  ;(window as any).__xmcl_agent = {
    send: (input: string) => session.send(input).catch((e) => console.error('[agent]', e)),
    reset: () => session.reset(),
    abort: () => session.abort(),
    get running() { return session.running.value },
    get messages() { return session.messages.value },
    get events() { return session.events.value },
  }
  watch(session.available, (available) => {
    console.info(available
      ? '[agent] ready — try window.__xmcl_agent.send("list my mods")'
      : '[agent] disabled (API key missing)')
  }, { immediate: true })
}
