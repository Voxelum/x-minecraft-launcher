import { getModSide, type ModFile } from '@/util/mod'
import { injection } from '@/util/inject'
import type { Instance, InstanceFile } from '@xmcl/instance'
import {
  InstanceInstallServiceKey,
  InstanceModsServiceKey,
  InstanceOptionsServiceKey,
  InstanceSavesServiceKey,
  InstanceServiceKey,
  JavaServiceKey,
  ModpackServiceKey,
  RemoteServerServiceKey,
  VersionServiceKey,
  type JavaRecord,
  type UserProfile,
} from '@xmcl/runtime-api'
import type { Ref } from 'vue'
import { kInstance } from '../instance'
import { kInstanceJava, type InstanceJavaStatus } from '../instanceJava'
import { kInstanceJavaDiagnose } from '../instanceJavaDiagnose'
import { kInstanceLaunch } from '../instanceLaunch'
import { kInstanceModsContext } from '../instanceMods'
import { kInstanceResourcePacks, type InstanceResourcePack } from '../instanceResourcePack'
import { kInstanceSave, type InstanceSaveFile } from '../instanceSave'
import { kInstanceShaderPacks, type InstanceShaderFile } from '../instanceShaderPack'
import { kInstanceVersion } from '../instanceVersion'
import { kInstanceVersionInstall, type InstanceInstallInstruction } from '../instanceVersionInstall'
import { useInstanceVersionServerInstall } from '../instanceVersionServerInstall'
import { kInstances } from '../instances'
import { kJavaContext } from '../java'
import { kModDependenciesCheck } from '../modDependenciesCheck'
import { kModLibCleaner } from '../modLibCleaner'
import { kModUpgrade } from '../modUpgrade'
import { useService } from '../service'
import { kUserContext } from '../user'
import { createAgentModDiagnosis } from './modDiagnosis'

export interface AgentCapabilityContext {
  instance: Ref<Instance>
  javaStatus: Ref<InstanceJavaStatus | undefined>
  userProfile: Ref<UserProfile>
  accounts: Ref<UserProfile[]>
  selectAccount(id: string): void
  mods: Ref<ModFile[]>
  resourcePacks: Ref<InstanceResourcePack[]>
  shaderPacks: Ref<InstanceShaderFile[]>
  selectedShaderPack: Ref<string>
  saves: Ref<InstanceSaveFile[]>
  installInstruction: Ref<InstanceInstallInstruction | undefined>
  installInstance(): Promise<unknown>
  fixInstanceInstall(): Promise<void>
  enableResourcePack(packs: InstanceResourcePack[] | string[]): Promise<unknown>
  disableResourcePack(packs: InstanceResourcePack[]): Promise<unknown>
  selectShaderPack(fileName: string | undefined): void
  launch(): Promise<{ operationId: string; pid?: number; launchId?: string } | undefined>
  killGame(side?: 'client' | 'server', force?: boolean): Promise<void>
  checkModDependencies(): Promise<unknown>
  diagnoseModCompatibility(changes: { added: string[]; removed: string[] }): Promise<unknown>
  installModDependencies(): Promise<unknown>
  scanUnusedMods(): Promise<unknown>
  checkModUpdates(options: { policy?: string; skipVersion?: boolean }): Promise<unknown>
  stageModUpdates(): Promise<unknown>
  javaList: Ref<JavaRecord[]>
  javaIssue: Ref<'invalid' | 'incompatible' | undefined>
  refreshJavaList(force?: boolean): Promise<void>
  installJava(forceZulu?: boolean): Promise<unknown>
  getServerStatus(): Promise<unknown>
  installServer(): Promise<unknown>
  deployServerMods(paths?: string[]): Promise<unknown>
  launchServer(options?: { nogui?: boolean }): Promise<unknown>
  getRemoteServerStatus(): Promise<unknown>
  testRemoteServerConnection(): Promise<unknown>
  installRemoteServerService(): Promise<unknown>
  uninstallRemoteServerService(): Promise<unknown>
  startRemoteServer(): Promise<unknown>
  stopRemoteServer(): Promise<unknown>
  restartRemoteServer(): Promise<unknown>
}

export function useAgentCapabilityContext() {
  const { instance } = injection(kInstance)
  const { selectedInstance } = injection(kInstances)
  const { serverVersionId, resolvedVersion, refreshResolvedVersion } = injection(kInstanceVersion)
  const { instruction: installInstruction, fix: fixInstanceInstall, getInstallInstruction, handleInstallInstruction, getInstanceLock } = injection(kInstanceVersionInstall)
  const { status: javaStatus } = injection(kInstanceJava)
  const instanceModsContext = injection(kInstanceModsContext)
  const { mods } = instanceModsContext
  const { enabled: resourcePacksEnabled, disabled: resourcePacksDisabled, enable: enableResourcePack, disable: disableResourcePack } = injection(kInstanceResourcePacks)
  const { shaderPacks, shaderPack: selectedShaderPack } = injection(kInstanceShaderPacks)
  const { saves } = injection(kInstanceSave)
  const { userProfile, users, select: selectAccount } = injection(kUserContext)
  const { launch, kill, serverCount } = injection(kInstanceLaunch)
  const dependencyCheck = injection(kModDependenciesCheck)
  const libraryCleaner = injection(kModLibCleaner)
  const modUpgrade = injection(kModUpgrade)
  const { all: javaList, refresh: refreshJavaList } = injection(kJavaContext)
  const { issue: javaIssue } = injection(kInstanceJavaDiagnose)
  const instanceInstall = useService(InstanceInstallServiceKey)
  const instanceMods = useService(InstanceModsServiceKey)
  const instanceOptions = useService(InstanceOptionsServiceKey)
  const instanceService = useService(InstanceServiceKey)
  const modpackService = useService(ModpackServiceKey)
  const savesService = useService(InstanceSavesServiceKey)
  const javaService = useService(JavaServiceKey)
  const versionService = useService(VersionServiceKey)
  const remoteServerService = useService(RemoteServerServiceKey)
  const { install: installServerVersion } = useInstanceVersionServerInstall()

  const resourcePacks = computed(() => [...resourcePacksEnabled.value, ...resourcePacksDisabled.value])
  const selectedShaderPackName = computed({
    get: () => selectedShaderPack.value ?? '',
    set: value => { selectedShaderPack.value = value || undefined },
  })

  const currentInstancePath = () => selectedInstance.value || instance.value.path || undefined
  const operationId = () => crypto.getRandomValues(new Uint8Array(8)).join('')

  async function installInstance() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    await refreshResolvedVersion()
    const resolved = resolvedVersion.value
    if (!resolved) return { error: 'instance version is not available' }
    const instruction = await getInstallInstruction(
      path,
      resolved.requirements,
      resolved.version,
      'id' in resolved ? resolved : undefined,
      javaList.value,
    )
    await getInstanceLock(path).runExclusive(() => handleInstallInstruction(instruction))
    await refreshResolvedVersion()
    return { ok: true, instruction }
  }

  async function checkModDependencies() {
    await dependencyCheck.refresh()
    const missing = dependencyCheck.installation.value.map(([file, mod]) => ({
      file: file.path,
      requiredBy: mod.name || mod.fileName,
    }))
    const error = dependencyCheck.error.value
    return { missing, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
  }

  async function diagnoseModCompatibility(changes: { added: string[]; removed: string[] }) {
    const fileName = (path: string) => path.replace(/\\/g, '/').split('/').at(-1) || path
    const added = new Set(changes.added.map(fileName))
    const removed = new Set(changes.removed.map(fileName).filter(name => !added.has(name)))

    const settled = await instanceModsContext.revalidateAndWait((mods) => {
      const current = new Set(mods.map(mod => mod.fileName))
      return [...added].every(name => current.has(name)) && [...removed].every(name => !current.has(name))
    })

    return createAgentModDiagnosis(
      instanceModsContext.mods.value,
      instanceModsContext.compatibility.value,
      instanceModsContext.conflicted.value,
      !settled,
      instanceModsContext.loaderIncompatibilities.value,
    )
  }

  async function installModDependencies() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const files = dependencyCheck.installation.value.map(([file]) => file)
    if (!files.length) return { installed: 0, note: 'No missing dependencies. Run `mod dependencies check` first.' }
    const manifest = await instanceInstall.stageInstanceFiles({ path, oldFiles: [], files, id: operationId() })
    return { staged: files.length, files: files.map(file => file.path), manifest }
  }

  async function scanUnusedMods() {
    await libraryCleaner.refresh()
    const unused = libraryCleaner.unusedMods.value.map(file => ({ path: file.path }))
    const error = libraryCleaner.error.value
    return { unused, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
  }

  function normalizeUpgradePolicy(policy?: string): 'curseforge' | 'modrinth' | 'curseforgeOnly' | 'modrinthOnly' {
    const candidate = policy ?? String(modUpgrade.upgradePolicy.value)
    if (candidate === 'curseforge' || candidate === 'curseforgeOnly' || candidate === 'modrinthOnly') return candidate
    return 'modrinth'
  }

  async function checkModUpdates(options: { policy?: string; skipVersion?: boolean }) {
    const policy = normalizeUpgradePolicy(options.policy)
    const skipVersion = options.skipVersion ?? modUpgrade.skipVersion.value
    await modUpgrade.refresh({ policy, skipVersion })
    const updates = Object.values(modUpgrade.plans.value).map(plan => ({
      mod: plan.mod.name || plan.mod.fileName,
      from: plan.mod.version,
      to: 'version' in plan ? plan.version.version_number || plan.version.name : plan.file.displayName || plan.file.fileName,
      source: 'version' in plan ? 'modrinth' : 'curseforge',
    }))
    const error = modUpgrade.error.value
    return { updates, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
  }

  async function stageModUpdates() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const plans = Object.values(modUpgrade.plans.value)
    if (!plans.length) return { upgraded: 0, note: 'No updates available. Run `mod update check` first.' }
    const { oldFiles, files } = modUpgrade.prepareUpgradeManifest()
    const manifest = await instanceInstall.stageInstanceFiles({ path, oldFiles, files, id: operationId() })
    return { staged: plans.length, mods: plans.map(plan => plan.mod.name || plan.mod.fileName), manifest }
  }

  async function installJava(forceZulu = false) {
    const required = javaStatus.value?.javaVersion
    const installed = await javaService.installJava(required, forceZulu)
    await refreshJavaList(true).catch(() => undefined)
    return {
      ok: true,
      sourcePreference: forceZulu ? 'zulu' : 'official-with-zulu-fallback',
      requiredMajorVersion: required?.majorVersion,
      path: installed.path,
      version: installed.version,
      majorVersion: installed.majorVersion,
    }
  }

  let installedServerVersion: string | undefined
  const serverFitMods = () => {
    const runtime = instance.value.runtime
    const loader = runtime.neoForged ? 'neoforge' : runtime.forge ? 'forge' : runtime.quiltLoader ? 'quilt' : 'fabric'
    return mods.value.filter(mod => mod.enabled && getModSide(mod, loader) !== 'CLIENT')
  }
  const serverVersionResolves = (id: string | undefined) =>
    id ? versionService.resolveServerVersion(id).then(() => true, () => false) : Promise.resolve(false)

  async function installServer() {
    if (!currentInstancePath()) return { error: 'no instance selected' }
    const version = await installServerVersion()
    installedServerVersion = version || installedServerVersion
    if (version) await versionService.refreshServerVersion(version).catch(() => undefined)
    return { ok: true, version }
  }

  async function getServerStatus() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
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
    }
  }

  async function deployServerMods(paths?: string[]) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const files = paths?.length ? paths : serverFitMods().map(mod => mod.path)
    if (!files.length) return { deployed: 0, note: 'No server-compatible enabled mods to deploy.' }
    await instanceMods.installToServerInstance({ path, files })
    return { ok: true, deployed: files.length, files }
  }

  function requireRemoteServerConfigured(path: string | undefined) {
    if (!path) return { error: 'no instance selected' } as const
    if (!instance.value.remoteServer) {
      return { error: 'No remote server is configured for this instance. Ask the user to fill in the connection details in Base Setting > Remote Server Admin first.' } as const
    }
    return undefined
  }

  async function getRemoteServerStatus() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.getStatus(path!)
  }

  async function testRemoteServerConnection() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.testConnection(path!)
  }

  async function installRemoteServerService() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.installService(path!)
  }

  async function uninstallRemoteServerService() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.uninstallService(path!)
  }

  async function startRemoteServer() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.startService(path!)
  }

  async function stopRemoteServer() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.stopService(path!)
  }

  async function restartRemoteServer() {
    const path = currentInstancePath()
    const guard = requireRemoteServerConfigured(path)
    if (guard) return guard
    return remoteServerService.restartService(path!)
  }

  async function launchServer(options?: { nogui?: boolean }) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    if (!await instanceOptions.getEULA(path).catch(() => false)) {
      return { error: 'EULA not accepted. The user must explicitly agree before launching the server.' }
    }
    let version = serverVersionId.value || installedServerVersion
    if (!await serverVersionResolves(version)) {
      version = await installServerVersion()
      installedServerVersion = version || installedServerVersion
    }
    const before = serverCount.value
    await launch('server', { nogui: options?.nogui, version })
    for (let index = 0; index < 8; index++) {
      await new Promise<void>(resolve => setTimeout(resolve, 400))
      if (serverCount.value <= before) {
        return { ok: false, version, error: 'The server process exited immediately. Inspect launches/latest or server logs.' }
      }
    }
    return { ok: true, version }
  }

  const context: AgentCapabilityContext = {
    instance,
    javaStatus,
    userProfile,
    accounts: users,
    selectAccount,
    mods,
    resourcePacks,
    shaderPacks,
    selectedShaderPack: selectedShaderPackName,
    saves,
    installInstruction,
    installInstance,
    fixInstanceInstall: async () => { await fixInstanceInstall() },
    enableResourcePack: packs => enableResourcePack(packs as any),
    disableResourcePack,
    selectShaderPack: fileName => { selectedShaderPack.value = fileName },
    launch: () => launch(),
    killGame: (side, force) => kill(side, force),
    checkModDependencies,
    diagnoseModCompatibility,
    installModDependencies,
    scanUnusedMods,
    checkModUpdates,
    stageModUpdates,
    javaList,
    javaIssue,
    refreshJavaList,
    installJava,
    getServerStatus,
    installServer,
    deployServerMods,
    launchServer,
    getRemoteServerStatus,
    testRemoteServerConnection,
    installRemoteServerService,
    uninstallRemoteServerService,
    startRemoteServer,
    stopRemoteServer,
    restartRemoteServer,
  }

  return {
    context,
    services: {
      instanceService,
      modpackService,
      savesService,
      versionService,
    },
  }
}
