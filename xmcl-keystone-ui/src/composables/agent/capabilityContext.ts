import { getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { getModSide, type ModFile } from '@/util/mod'
import { getInstanceFileFromModrinthVersion } from '@/util/modrinth'
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
  fixInstanceInstall(): Promise<void>
  enableResourcePack(packs: InstanceResourcePack[] | string[]): Promise<unknown>
  disableResourcePack(packs: InstanceResourcePack[]): Promise<unknown>
  selectShaderPack(fileName: string | undefined): void
  launch(): Promise<void>
  killGame(side?: 'client' | 'server', force?: boolean): Promise<void>
  checkModDependencies(): Promise<unknown>
  installModDependencies(): Promise<unknown>
  scanUnusedMods(): Promise<unknown>
  disableUnusedMods(): Promise<unknown>
  checkModUpdates(options: { policy?: string; skipVersion?: boolean }): Promise<unknown>
  applyModUpdates(): Promise<unknown>
  javaList: Ref<JavaRecord[]>
  javaIssue: Ref<'invalid' | 'incompatible' | undefined>
  installJava(): Promise<unknown>
  getServerStatus(): Promise<unknown>
  installServer(): Promise<unknown>
  setServerEula(accepted: boolean): Promise<unknown>
  setServerProperties(properties: Record<string, string | number | boolean>): Promise<unknown>
  deployServerMods(paths?: string[]): Promise<unknown>
  launchServer(options?: { nogui?: boolean }): Promise<unknown>
  setServerFile(file: string, content: string): Promise<unknown>
}

export function useAgentCapabilityContext() {
  const { instance } = injection(kInstance)
  const { selectedInstance } = injection(kInstances)
  const { serverVersionId } = injection(kInstanceVersion)
  const { instruction: installInstruction, fix: fixInstanceInstall } = injection(kInstanceVersionInstall)
  const { status: javaStatus } = injection(kInstanceJava)
  const { mods } = injection(kInstanceModsContext)
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
  const { install: installServerVersion } = useInstanceVersionServerInstall()

  const resourcePacks = computed(() => [...resourcePacksEnabled.value, ...resourcePacksDisabled.value])
  const selectedShaderPackName = computed({
    get: () => selectedShaderPack.value ?? '',
    set: value => { selectedShaderPack.value = value || undefined },
  })

  const currentInstancePath = () => selectedInstance.value || instance.value.path || undefined
  const operationId = () => crypto.getRandomValues(new Uint8Array(8)).join('')

  async function checkModDependencies() {
    await dependencyCheck.refresh()
    const missing = dependencyCheck.installation.value.map(([file, mod]) => ({
      file: file.path,
      requiredBy: mod.name || mod.fileName,
    }))
    const error = dependencyCheck.error.value
    return { missing, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
  }

  async function installModDependencies() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const files = dependencyCheck.installation.value.map(([file]) => file)
    if (!files.length) return { installed: 0, note: 'No missing dependencies. Run check_mod_dependencies first.' }
    await instanceInstall.installInstanceFiles({ path, oldFiles: [], files, id: operationId() })
    return { installed: files.length, files: files.map(file => file.path) }
  }

  async function scanUnusedMods() {
    await libraryCleaner.refresh()
    const unused = libraryCleaner.unusedMods.value.map(file => ({ path: file.path }))
    const error = libraryCleaner.error.value
    return { unused, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
  }

  async function disableUnusedMods() {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    const oldFiles = libraryCleaner.unusedMods.value
    if (!oldFiles.length) return { disabled: 0, note: 'No unused library mods. Run scan_unused_mods first.' }
    const files = oldFiles.map(file => ({ ...file, path: `${file.path}.disabled` }))
    await instanceInstall.installInstanceFiles({ path, oldFiles, files, id: operationId() })
    return { disabled: oldFiles.length, files: oldFiles.map(file => file.path) }
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
    await instanceInstall.installInstanceFiles({ path, oldFiles, files, id: operationId() })
    return { upgraded: plans.length, mods: plans.map(plan => plan.mod.name || plan.mod.fileName) }
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
    const [eula, properties, deployed] = await Promise.all([
      instanceOptions.getEULA(path).catch(() => false),
      instanceOptions.getServerProperties(path).catch(() => ({} as Record<string, string>)),
      instanceMods.getServerInstanceMods(path).catch(() => [] as Array<{ fileName: string }>),
    ])
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
      deployedMods: deployed.map(file => file.fileName),
    }
  }

  async function setServerEula(accepted: boolean) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    await instanceOptions.setEULA(path, accepted)
    return { ok: true, eula: accepted }
  }

  async function setServerProperties(properties: Record<string, string | number | boolean>) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    await instanceOptions.setServerProperties(path, properties)
    return {
      ok: true,
      properties: await instanceOptions.getServerProperties(path).catch(() => ({} as Record<string, string>)),
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

  async function setServerFile(file: string, content: string) {
    const path = currentInstancePath()
    if (!path) return { error: 'no instance selected' }
    await instanceOptions.setServerFile(path, file, content)
    return { ok: true, file }
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
        return { ok: false, version, error: 'The server process exited immediately. Inspect launch-failures or server logs.' }
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
    fixInstanceInstall: async () => { await fixInstanceInstall() },
    enableResourcePack: packs => enableResourcePack(packs as any),
    disableResourcePack,
    selectShaderPack: fileName => { selectedShaderPack.value = fileName },
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
  }

  return {
    context,
    services: {
      instanceService,
      modpackService,
      savesService,
    },
  }
}
