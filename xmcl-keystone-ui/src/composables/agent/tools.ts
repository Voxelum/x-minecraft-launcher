import type { Instance } from '@xmcl/instance'
import type { GameOptionsState, JavaRecord, UserProfile } from '@xmcl/runtime-api'
import {
  InstanceLogServiceKey,
  InstanceModsServiceKey,
  InstanceOptionsServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceSavesServiceKey,
  InstanceServiceKey,
  InstanceShaderPacksServiceKey,
  ModpackServiceKey,
  VersionMetadataServiceKey,
  VersionServiceKey,
} from '@xmcl/runtime-api'
import type { GameProcess } from '@xmcl/runtime-api'
import type { Router } from 'vue-router'
import { useService } from '../service'
import type { ModFile } from '@/util/mod'
import type { InstanceResourcePack } from '../instanceResourcePack'
import type { InstanceShaderFile } from '../instanceShaderPack'
import type { InstanceSaveFile } from '../instanceSave'
import type { InstanceJavaStatus } from '../instanceJava'
import type { InstanceResolveVersion } from '../instanceVersion'
import type { InstanceInstallInstruction } from '../instanceVersionInstall'
import type { Tool } from './loop'
import { createAccountCommand } from './cli/account'
import { createDiagnoseCommand } from './cli/diagnose'
import { createGrepCommand } from './cli/grep'
import { createHelpCommand, type HelpDomain } from './cli/help'
import { createInstanceAdminOperations, createInstanceCommand } from './cli/instance'
import { createJavaCommand } from './cli/java'
import { createKillCommand } from './cli/kill'
import { createLaunchCommand } from './cli/launch'
import { createMarketCliOperations, createMarketCommand } from './cli/market'
import { createModsCommand, type ModsCliOperations } from './cli/mods'
import { createPackCommand, type PackKind, type PackUpdateOperations } from './cli/packs'
import { createMvCommand } from './cli/mv'
import { createNavigateCommand } from './cli/navigate'
import { createRepairCommand } from './cli/repair'
import { createServerCommand } from './cli/server'
import { createWorldCommand } from './cli/world'
import { createVersionCommand } from './cli/version'
import { WORLDS_CLI_INSTRUCTIONS } from './worldsTools'
import type { InstanceChangeOperations } from './instanceChanges'

export interface AgentContext {
  router: Router
  instance: Ref<Instance>
  instances: Ref<Instance[]>
  selectedInstancePath: Ref<string>
  resolvedVersion: Ref<InstanceResolveVersion | undefined>
  javaStatus: Ref<InstanceJavaStatus | undefined>
  java: Ref<JavaRecord | undefined>
  userProfile: Ref<UserProfile>
  mods: Ref<ModFile[]>
  resourcePacks: Ref<InstanceResourcePack[]>
  shaderPacks: Ref<InstanceShaderFile[]>
  selectedShaderPack: Ref<string>
  gameProcesses: Readonly<Ref<GameProcess[]>>
  saves: Ref<InstanceSaveFile[]>
  gameOptions: Ref<GameOptionsState | undefined>
  installInstruction: Ref<InstanceInstallInstruction | undefined>
  fixInstanceInstall: () => Promise<void>
  launch: (side?: 'client' | 'server', options?: { nogui?: boolean }) => Promise<unknown>
  killGame: (side?: 'client' | 'server', force?: boolean) => Promise<void>
  modMaintenance: ModsCliOperations
  packUpdates: Record<PackKind, PackUpdateOperations>
  instanceChanges: InstanceChangeOperations
  javaList: Ref<JavaRecord[]>
  javaIssue: Ref<'invalid' | 'incompatible' | undefined>
  installJava: (options?: { majorVersion?: number; component?: string; forceZulu?: boolean }) => Promise<unknown>
  getServerStatus: () => Promise<unknown>
  installServer: () => Promise<unknown>
  setServerEula: (accepted: boolean) => Promise<unknown>
  deployServerMods: (paths?: string[]) => Promise<unknown>
  /** Intercept destructive VFS deletions so the UI can request confirmation. Return false to cancel. */
  interceptDelete?: (request: VfsDeleteRequest) => Promise<boolean | void>
  accounts: Ref<UserProfile[]>
  selectAccount: (id: string) => void
}

function trimMod(m: ModFile) {
  return { modId: m.modId, name: m.name, version: m.version, fileName: m.fileName, path: m.path, enabled: m.enabled, loaders: m.modLoaders, description: m.description?.slice(0, 200) }
}

function trimResourcePack(p: InstanceResourcePack) {
  return { id: p.id, name: p.name, fileName: p.fileName, enabled: p.enabled, path: p.path, acceptingRange: p.acceptingRange }
}

function trimShaderPack(s: InstanceShaderFile) {
  return { fileName: s.fileName, path: s.path, enabled: s.enabled }
}

function trimSave(s: InstanceSaveFile) {
  return { name: s.name, path: s.path, enabled: s.enabled, levelName: s.levelName, gameVersion: s.gameVersion, lastPlayed: s.lastPlayed }
}

function summarizeInstallInstruction(inst: InstanceInstallInstruction | undefined) {
  if (!inst) return { available: false, note: 'No diagnosis available yet (no instance selected or version not resolved).' }
  const missingLibraries = inst.libraries?.length ?? 0
  const missingAssets = inst.assets?.length ?? 0
  const issues: string[] = []
  if (!inst.resolvedVersion) issues.push('version not resolved — core game files are likely not installed')
  if (inst.jar) issues.push(`minecraft jar missing or corrupted (${inst.jar})`)
  if (inst.forge) issues.push(`forge not installed (minecraft ${inst.forge.minecraft}, forge ${inst.forge.version})`)
  if (inst.optifine) issues.push(`optifine not installed (${inst.optifine})`)
  if (inst.profile) issues.push('mod-loader install profile must be run (Forge/NeoForge post-processing)')
  if (inst.assetsIndex) issues.push('assets index missing or corrupted')
  if (missingLibraries) issues.push(`${missingLibraries} missing or corrupted libraries`)
  if (missingAssets) issues.push(`${missingAssets} missing assets`)
  if (inst.java) issues.push(`required Java (major ${inst.java.majorVersion}) is not installed`)
  return {
    available: true,
    instance: inst.instance,
    runtime: inst.runtime,
    selectedVersion: inst.version,
    resolvedVersion: inst.resolvedVersion,
    healthy: issues.length === 0,
    issues,
    counts: { libraries: missingLibraries, assets: missingAssets },
  }
}

// Keep this list in sync with `xmcl-keystone-ui/src/windows/main/router.ts`.
// Restricting the LLM to a known set avoids it inventing routes that would
// 404 to a blank pane.
const KNOWN_ROUTES = [
  '/',
  '/mods',
  '/resourcepacks',
  '/shaderpacks',
  '/save',
  '/base-setting',
  '/me',
  '/multiplayer',
  '/setting',
  '/store',
] as const

// ── Virtual FS ──────────────────────────────────────────────────────────
// A read-only view over launcher state shaped like the instance directory.
// Paths are POSIX-style and rooted at the instance folder. The agent always
// uses relative paths (no leading `/`) and the resolver finds the right
// composable / service call.

type VfsEntry =
  | { type: 'dir'; name: string; description: string }
  | { type: 'file'; name: string; size?: number; description?: string }

type VfsEntryHandler = {
  list?: (instancePath: string, rest: string) => Promise<unknown>
  read?: (instancePath: string, rest: string, tailLines?: unknown) => Promise<unknown>
  remove?: (instancePath: string, rest: string) => Promise<unknown>
}

export interface VfsDeleteRequest {
  instancePath: string
  paths: string[]
}

const DISABLED_SUFFIX = '.disabled'

function stripDisabled(name: string): string {
  return name.endsWith(DISABLED_SUFFIX) ? name.slice(0, -DISABLED_SUFFIX.length) : name
}

/**
 * Tokenise a single shell command into argv, honouring single/double quotes
 * and backslash escapes. Returns `{ error }` on malformed quoting. The
 * restricted `bash` tool is the only caller, so there is intentionally no
 * support for pipes, redirection, globbing, or variable expansion — those
 * characters are treated literally.
 */
function tokenizeCommand(input: string): string[] | { error: string } {
  const tokens: string[] = []
  let token = ''
  let inToken = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (c === "'") {
      inToken = true
      i++
      while (i < input.length && input[i] !== "'") { token += input[i]; i++ }
      if (i >= input.length) return { error: 'unterminated single quote' }
    } else if (c === '"') {
      inToken = true
      i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) { token += input[i + 1]; i += 2 }
        else { token += input[i]; i++ }
      }
      if (i >= input.length) return { error: 'unterminated double quote' }
    } else if (c === '\\' && i + 1 < input.length) {
      inToken = true
      token += input[i + 1]
      i++
    } else if (/\s/.test(c)) {
      if (inToken) { tokens.push(token); token = ''; inToken = false }
    } else {
      inToken = true
      token += c
    }
  }
  if (inToken) tokens.push(token)
  return tokens
}

type AssetKind = 'mods' | 'resourcepacks' | 'shaderpacks' | 'saves' | 'logs' | 'crash-reports' | 'launch-failures' | 'config' | 'game-processes' | 'shader-options'

function pathKind(path: string): { kind: AssetKind | 'instance.json' | 'options.txt' | 'root'; rest: string } {
  const clean = path.replace(/^\.?\/+/, '').replace(/\/+$/, '')
  if (!clean) return { kind: 'root', rest: '' }
  if (clean === 'instance.json') return { kind: 'instance.json', rest: '' }
  if (clean === 'options.txt') return { kind: 'options.txt', rest: '' }
  const [head, ...rest] = clean.split('/')
  if (head === 'mods' || head === 'resourcepacks' || head === 'shaderpacks' || head === 'saves' || head === 'logs' || head === 'crash-reports' || head === 'launch-failures' || head === 'config' || head === 'game-processes' || head === 'shader-options') {
    return { kind: head, rest: rest.join('/') }
  }
  return { kind: 'root', rest: clean }
}

function resolveVfsPath(path: string): { key: string; rest: string } {
  const clean = path.replace(/^\.?\/+/, '').replace(/\/+$/, '')
  if (clean === 'server' || clean.startsWith('server/')) {
    return { key: 'server', rest: clean === 'server' ? '' : clean.slice('server/'.length) }
  }
  const parsed = pathKind(clean)
  return { key: parsed.kind, rest: parsed.rest }
}

// ── Local-server virtual subtree (`server/...`) ──────────────────────────
// The dedicated server lives at `<instance>/server/`. The log & config
// services join their own subdir to the path they are given, so pointing them
// at `<instance>/server` reads `<instance>/server/{logs,config,crash-reports}`.

/** Absolute path of the local-server subfolder for an instance. */
function serverDir(instancePath: string): string {
  return instancePath.replace(/[\\/]+$/, '') + '/server'
}

type ServerKind = 'root' | 'mods' | 'config' | 'logs' | 'crash-reports' | 'server.properties' | 'eula.txt' | 'rootfile' | 'unknown'

/** Top-level server admin files exposed as raw text (parallels the backend allowlist). */
const SERVER_ROOT_FILES = ['ops.json', 'whitelist.json', 'banned-ips.json', 'banned-players.json', 'usercache.json'] as const

/**
 * Parse a `server/...` virtual path into the local-server subtree, or `null`
 * when the path is not under `server/` (so callers fall back to the client vfs).
 */
function serverPathKind(path: string): { kind: ServerKind; rest: string } | null {
  const clean = path.replace(/^\.?\/+/, '').replace(/\/+$/, '')
  if (clean !== 'server' && !clean.startsWith('server/')) return null
  const sub = clean === 'server' ? '' : clean.slice('server/'.length)
  if (!sub) return { kind: 'root', rest: '' }
  if (sub === 'server.properties') return { kind: 'server.properties', rest: '' }
  if (sub === 'eula.txt') return { kind: 'eula.txt', rest: '' }
  if ((SERVER_ROOT_FILES as readonly string[]).includes(sub)) return { kind: 'rootfile', rest: sub }
  const [head, ...rest] = sub.split('/')
  if (head === 'mods' || head === 'config' || head === 'logs' || head === 'crash-reports') {
    return { kind: head, rest: rest.join('/') }
  }
  return { kind: 'unknown', rest: sub }
}

// ── Factory ─────────────────────────────────────────────────────────────

export interface ToolRegistry {
  /** Tools always exposed to the LLM. */
  base: Tool[]
  /** Detailed workflows available on demand through `bash help domain <name>`. */
  helpDomains: Record<string, HelpDomain>
}

export function createXmclTools(ctx: AgentContext): ToolRegistry {
  const instanceMods = useService(InstanceModsServiceKey)
  const logService = useService(InstanceLogServiceKey)
  const resourcePackService = useService(InstanceResourcePacksServiceKey)
  const shaderPackService = useService(InstanceShaderPacksServiceKey)
  const modpackService = useService(ModpackServiceKey)
  const versionMetadataService = useService(VersionMetadataServiceKey)
  const versionService = useService(VersionServiceKey)
  const optionsService = useService(InstanceOptionsServiceKey)
  const instanceService = useService(InstanceServiceKey)
  const savesService = useService(InstanceSavesServiceKey)
  const shaderOptionLoaders = ['vanilla', 'iris', 'oculus'] as const
  const marketOperations = createMarketCliOperations({
    currentInstance: () => ctx.instance.value,
    instanceChanges: ctx.instanceChanges,
    modpackService,
  })

  const tools: Tool[] = []
  const tool = (t: Tool) => { tools.push(t) }

  function modByPathOrId(needle: string): ModFile | undefined {
    return ctx.mods.value.find((m) => m.path === needle || m.fileName === needle || m.modId === needle)
  }

  // ── Local-server vfs helpers (read the `<instance>/server/` subtree) ──

  async function listServerVfs(sp: { kind: ServerKind; rest: string }, instPath: string) {
    const sdir = serverDir(instPath)
    if (sp.kind === 'root') {
      const [serverMods, eula, props] = await Promise.all([
        instanceMods.getServerInstanceMods(instPath).catch(() => [] as Array<{ fileName: string; ino: number }>),
        optionsService.getEULA(instPath).catch(() => false),
        optionsService.getServerProperties(instPath).catch(() => ({} as Record<string, string>)),
      ])
      const entries: VfsEntry[] = [
        { type: 'dir', name: 'mods', description: `${serverMods.length} server-deployed mods` },
        { type: 'dir', name: 'config', description: 'server mod config files' },
        { type: 'dir', name: 'logs', description: 'server log files (latest.log, ...)' },
        { type: 'dir', name: 'crash-reports', description: 'server crash reports' },
        { type: 'file', name: 'server.properties', description: `raw server.properties${props.port ? ` (port ${props.port})` : ''}` },
        { type: 'file', name: 'eula.txt', description: `EULA ${eula ? 'accepted' : 'not accepted'}` },
        { type: 'file', name: 'ops.json', description: 'server operators (raw JSON)' },
        { type: 'file', name: 'whitelist.json', description: 'server whitelist (raw JSON)' },
        { type: 'file', name: 'banned-players.json', description: 'banned players (raw JSON)' },
        { type: 'file', name: 'banned-ips.json', description: 'banned IPs (raw JSON)' },
        { type: 'file', name: 'usercache.json', description: 'player name/uuid cache (raw JSON)' },
      ]
      return { path: sdir, entries }
    }
    if (sp.kind === 'mods') {
      const serverMods = await instanceMods.getServerInstanceMods(instPath).catch(() => [] as Array<{ fileName: string; ino: number }>)
      return serverMods.map((m) => ({ type: 'file' as const, name: m.fileName, path: `server/mods/${m.fileName}`, ino: m.ino }))
    }
    if (sp.kind === 'config') {
      const files = await optionsService.getInstanceConfigFiles(sdir).catch(() => [] as string[])
      return files.map((f) => ({ type: 'file' as const, name: f, path: `server/config/${f}` }))
    }
    if (sp.kind === 'logs') return await logService.listLogs(sdir)
    if (sp.kind === 'crash-reports') return await logService.listCrashReports(sdir)
    return { error: `not a server directory: server/${sp.rest}` }
  }

  async function readServerVfs(sp: { kind: ServerKind; rest: string }, instPath: string, tailLines: unknown) {
    const sdir = serverDir(instPath)
    if (sp.kind === 'server.properties') {
      try {
        const text = await optionsService.getServerFile(instPath, 'server.properties')
        return text === '' ? { note: 'server/server.properties does not exist yet', content: '' } : text
      } catch (e) {
        return { error: `cannot read server.properties: ${e instanceof Error ? e.message : String(e)}` }
      }
    }
    if (sp.kind === 'eula.txt') {
      return { accepted: await optionsService.getEULA(instPath).catch(() => false) }
    }
    if (sp.kind === 'rootfile') {
      try {
        const text = await optionsService.getServerFile(instPath, sp.rest)
        return text === '' ? { note: `server/${sp.rest} does not exist yet`, content: '' } : text
      } catch (e) {
        return { error: `cannot read server/${sp.rest}: ${e instanceof Error ? e.message : String(e)}` }
      }
    }
    if (sp.kind === 'config') {
      if (!sp.rest) return { error: 'server/config is a directory; use vfs_list' }
      try {
        return await optionsService.getInstanceConfig(sdir, sp.rest)
      } catch (e) {
        return { error: `cannot read server/config/${sp.rest}: ${e instanceof Error ? e.message : String(e)}` }
      }
    }
    if (sp.kind === 'logs') {
      if (!sp.rest) return { error: 'server/logs is a directory; use vfs_list' }
      const full = await logService.getLogContent(sdir, sp.rest)
      const tail = Math.min(Number(tailLines ?? 200) || 200, 2000)
      const lines = full.split('\n')
      return lines.length > tail ? lines.slice(-tail).join('\n') : full
    }
    if (sp.kind === 'crash-reports') {
      if (!sp.rest) return { error: 'server/crash-reports is a directory; use vfs_list' }
      return await logService.getCrashReportContent(sdir, sp.rest)
    }
    if (sp.kind === 'mods') {
      if (!sp.rest) return { error: 'server/mods is a directory; use vfs_list' }
      const serverMods = await instanceMods.getServerInstanceMods(instPath).catch(() => [] as Array<{ fileName: string; ino: number }>)
      const m = serverMods.find((x) => x.fileName === sp.rest)
      if (!m) return { error: `server mod not found: ${sp.rest}` }
      return { fileName: m.fileName, ino: m.ino, note: 'Server-deployed mod. Parsed metadata is not available here; if the same file is in the client mods/, read mods/<fileName> for details.' }
    }
    if (sp.kind === 'root') return { error: 'server is a directory; use vfs_list server' }
    return { error: `unknown server path: server/${sp.rest}` }
  }

  // Each top-level virtual filesystem entry owns the operations supported by
  // that entry. The generic vfs tools below only resolve a path and dispatch
  // to this registry; adding an entry no longer requires extending both tools
  // with another chain of conditions.
  const vfsEntries: Record<string, VfsEntryHandler> = {
    root: {
      list: async (instPath) => ({
        path: instPath,
        entries: [
          { type: 'dir', name: 'mods', description: `${ctx.mods.value.length} mods (${ctx.mods.value.filter((m) => m.enabled).length} enabled)` },
          { type: 'dir', name: 'resourcepacks', description: `${ctx.resourcePacks.value.length} packs` },
          { type: 'dir', name: 'shaderpacks', description: `${ctx.shaderPacks.value.length} packs${ctx.selectedShaderPack.value ? `, active: ${ctx.selectedShaderPack.value}` : ''}` },
          { type: 'dir', name: 'shader-options', description: 'configured shaderpack for vanilla, Iris, and Oculus' },
          { type: 'dir', name: 'saves', description: `${ctx.saves.value.length} worlds` },
          { type: 'dir', name: 'logs', description: 'minecraft log files' },
          { type: 'dir', name: 'crash-reports', description: 'minecraft crash reports' },
          { type: 'dir', name: 'launch-failures', description: 'launcher-captured abnormal-exit dumps (xmcl-abnormal-exit-*)' },
          { type: 'dir', name: 'config', description: 'mod config files (grep / edit_config)' },
          { type: 'dir', name: 'server', description: 'local dedicated server files (mods, config, logs, server.properties); empty until a server is installed' },
          { type: 'dir', name: 'game-processes', description: `${ctx.gameProcesses.value.length} client/server process${ctx.gameProcesses.value.length === 1 ? '' : 'es'} for this instance` },
          { type: 'file', name: 'instance.json', description: 'full instance settings' },
          { type: 'file', name: 'options.txt', description: 'parsed minecraft options' },
        ] as VfsEntry[],
      }),
    },
    'instance.json': {
      read: async () => ctx.instance.value,
    },
    'options.txt': {
      read: async () => ctx.gameOptions.value ?? { error: 'options.txt not loaded yet' },
    },
    mods: {
      list: async () => ctx.mods.value.map((m) => ({
        type: 'file' as const,
        name: m.fileName,
        path: m.path,
        enabled: m.enabled,
        modId: m.modId,
        version: m.version,
        loaders: m.modLoaders,
      })),
      read: async (_instPath, rest) => {
        const mod = modByPathOrId(rest)
        return mod ? trimMod(mod) : { error: `mod not found: ${rest}` }
      },
      remove: async (instPath, rest) => {
        const mod = modByPathOrId(rest) ?? modByPathOrId(stripDisabled(rest))
        if (!mod) return { error: `mod not found: ${rest}` }
        await instanceMods.uninstall({ path: instPath, files: [mod.path] })
        return { deleted: [rest] }
      },
    },
    resourcepacks: {
      list: async () => ctx.resourcePacks.value.map(trimResourcePack),
      read: async (_instPath, rest) => {
        const pack = ctx.resourcePacks.value.find((p) => p.id === rest || p.fileName === rest)
        return pack ? trimResourcePack(pack) : { error: `resourcepack not found: ${rest}` }
      },
      remove: async (instPath, rest) => {
        const pack = ctx.resourcePacks.value.find((p) => p.id === rest || p.fileName === rest)
        if (!pack?.path) return { error: `resourcepack not found: ${rest}` }
        await resourcePackService.uninstall({ path: instPath, files: [pack.path] })
        return { deleted: [rest] }
      },
    },
    shaderpacks: {
      list: async () => ({ selected: ctx.selectedShaderPack.value, entries: ctx.shaderPacks.value.map(trimShaderPack) }),
      read: async (_instPath, rest) => {
        const pack = ctx.shaderPacks.value.find((s) => s.fileName === rest)
        return pack ? trimShaderPack(pack) : { error: `shaderpack not found: ${rest}` }
      },
      remove: async (instPath, rest) => {
        const pack = ctx.shaderPacks.value.find((s) => s.fileName === rest)
        if (!pack?.path) return { error: `shaderpack not found: ${rest}` }
        await shaderPackService.uninstall({ path: instPath, files: [pack.path] })
        return { deleted: [rest] }
      },
    },
    'shader-options': {
      list: async (_instPath, rest) => rest
        ? { error: `shader-options/${rest} is a file; use vfs_read` }
        : shaderOptionLoaders.map((loader) => ({
          type: 'file' as const,
          name: loader,
          path: `shader-options/${loader}`,
          description: `${loader} shader loader options (read with vfs_read; write with edit_config)`,
        })),
      read: async (instPath, rest) => {
        if (!shaderOptionLoaders.includes(rest as typeof shaderOptionLoaders[number])) {
          return { error: `unknown shader option loader: ${rest}. Expected vanilla, iris, or oculus.` }
        }
        try {
          const options = rest === 'iris'
            ? await optionsService.getIrisShaderOptions(instPath)
            : rest === 'oculus'
              ? await optionsService.getOculusShaderOptions(instPath)
              : await optionsService.getShaderOptions(instPath)
          return `shaderPack=${options.shaderPack ?? ''}`
        } catch (e) {
          return { error: `cannot read shader-options/${rest}: ${e instanceof Error ? e.message : String(e)}` }
        }
      },
    },
    saves: {
      list: async () => ctx.saves.value.map(trimSave),
      read: async (_instPath, rest) => {
        const save = ctx.saves.value.find((s) => s.name === rest || s.path === rest)
        return save ? trimSave(save) : { error: `save not found: ${rest}` }
      },
      remove: async (instPath, rest) => {
        const save = ctx.saves.value.find((s) => s.name === rest || s.path === rest)
        if (!save) return { error: `save not found: ${rest}` }
        await savesService.deleteSave({ instancePath: instPath, saveName: save.name })
        return { deleted: [save.name] }
      },
    },
    'game-processes': {
      list: async () => ctx.gameProcesses.value.map((p) => ({
        type: 'file' as const,
        name: `${p.side}-${p.pid}`,
        path: `game-processes/${p.side}/${p.pid}`,
        pid: p.pid,
        side: p.side,
        ready: p.ready,
        gameDirectory: p.options.gameDirectory,
        version: p.options.version,
      })),
      read: async (_instPath, rest) => {
        const [side, pidText] = rest.split('/')
        const process = ctx.gameProcesses.value.find((p) => p.side === side && p.pid === Number(pidText))
        return process
          ? { pid: process.pid, side: process.side, ready: process.ready, gameDirectory: process.options.gameDirectory, version: process.options.version }
          : { error: `game process not found: ${rest}` }
      },
    },
    logs: {
      list: async (instPath) => logService.listLogs(instPath),
      read: async (instPath, rest, tailLines) => {
        const full = await logService.getLogContent(instPath, rest)
        const tail = Math.min(Number(tailLines ?? 200) || 200, 2000)
        const lines = full.split('\n')
        return lines.length > tail ? lines.slice(-tail).join('\n') : full
      },
      remove: async (instPath, rest) => {
        await logService.removeLog(instPath, rest)
        return { deleted: [rest] }
      },
    },
    'crash-reports': {
      list: async (instPath) => logService.listCrashReports(instPath),
      read: async (instPath, rest) => logService.getCrashReportContent(instPath, rest),
      remove: async (instPath, rest) => {
        await logService.removeCrashReport(instPath, rest)
        return { deleted: [rest] }
      },
    },
    'launch-failures': {
      list: async (instPath) => logService.listLaunchFailures(instPath),
      read: async (instPath, rest, tailLines) => {
        const full = await logService.getLogContent(instPath, rest)
        const tail = Math.min(Number(tailLines ?? 200) || 200, 2000)
        const lines = full.split('\n')
        return lines.length > tail ? lines.slice(-tail).join('\n') : full
      },
      remove: async (instPath, rest) => {
        await logService.removeLog(instPath, rest)
        return { deleted: [rest] }
      },
    },
    config: {
      list: async (instPath) => {
        const files = await optionsService.getInstanceConfigFiles(instPath)
        return files.map((f) => ({ type: 'file' as const, name: f, path: `config/${f}` }))
      },
      read: async (instPath, rest) => {
        if (!rest) return { error: 'config is a directory; use vfs_list or grep' }
        try {
          return await optionsService.getInstanceConfig(instPath, rest)
        } catch (e) {
          return { error: `cannot read config/${rest}: ${e instanceof Error ? e.message : String(e)}` }
        }
      },
      remove: async (instPath, rest) => {
        if (!rest) return { error: 'config is a directory; specify a file' }
        try {
          await optionsService.removeInstanceConfig(instPath, rest)
          return { deleted: [rest] }
        } catch (e) {
          return { error: `cannot delete config/${rest}: ${e instanceof Error ? e.message : String(e)}` }
        }
      },
    },
    server: {
      list: async (instPath, rest) => {
        const parsed = serverPathKind(rest ? `server/${rest}` : 'server')
        return parsed ? listServerVfs(parsed, instPath) : { error: `invalid server path: ${rest}` }
      },
      read: async (instPath, rest, tailLines) => {
        const parsed = serverPathKind(rest ? `server/${rest}` : 'server')
        return parsed ? readServerVfs(parsed, instPath, tailLines) : { error: `invalid server path: ${rest}` }
      },
      remove: async (instPath, rest) => {
        const parsed = serverPathKind(rest ? `server/${rest}` : 'server')
        if (!parsed) return { error: `invalid server path: ${rest}` }
        const sdir = serverDir(instPath)
        if (parsed.kind === 'mods') {
          if (!parsed.rest) return { error: 'server/mods is a directory; specify a file' }
          await instanceMods.uninstall({ path: sdir, files: [parsed.rest] })
        } else if (parsed.kind === 'config') {
          if (!parsed.rest) return { error: 'server/config is a directory; specify a file' }
          await optionsService.removeInstanceConfig(sdir, parsed.rest)
        } else if (parsed.kind === 'logs') {
          if (!parsed.rest) return { error: 'server/logs is a directory; specify a file' }
          await logService.removeServerLog(instPath, parsed.rest)
        } else if (parsed.kind === 'crash-reports') {
          if (!parsed.rest) return { error: 'server/crash-reports is a directory; specify a file' }
          await logService.removeCrashReport(sdir, parsed.rest)
        } else {
          return { error: `cannot delete server/${parsed.rest || 'root'}` }
        }
        return { deleted: [rest] }
      },
    },
  }

  // ── Virtual FS ──────────────────────────────────────────────────────

  tool({
    name: 'vfs_list',
    description: 'List entries under a virtual directory rooted at the current instance. Known directories: `mods`, `resourcepacks`, `shaderpacks`, `shader-options`, `saves`, `logs`, `crash-reports`, `config`, `game-processes`, and `server` (the LOCAL dedicated server folder: `server/mods`, `server/config`, `server/logs`, `server/crash-reports`). Use `""` or `"."` for the root.',
    readonly: true,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative directory path' } },
    },
    async execute(args) {
      const path = String(args.path ?? '')
      const inst = ctx.instance.value
      if (!inst.path) return { error: 'no instance selected' }
      const { key, rest: registryRest } = resolveVfsPath(path)
      const entry = vfsEntries[key]
      if (!entry?.list) return { error: `not a directory: ${path}` }
      return entry.list(inst.path, registryRest)

    },
  })

  tool({
    name: 'vfs_read',
    description: 'Read a virtual file. Examples: `instance.json` (full instance settings), `options.txt` (parsed game options), `mods/<fileName>` (mod metadata), `resourcepacks/<id>` (pack metadata), `shaderpacks/<fileName>`, `shader-options/<vanilla|iris|oculus>` (configured shaderpack), `saves/<name>`, `game-processes/<client|server>/<pid>` (tracked process details), `logs/<name>` (last 200 lines by default), `crash-reports/<name>`, `config/<file>` (raw config text). For the LOCAL dedicated server, prefix with `server/`: `server/server.properties`, `server/ops.json`, `server/whitelist.json`, `server/banned-players.json`, `server/banned-ips.json`, `server/usercache.json` (raw text), `server/eula.txt`, `server/config/<file>`, `server/logs/<name>`, `server/crash-reports/<name>`, `server/mods/<fileName>`.',
    readonly: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' },
        tailLines: { type: 'number', description: 'For log files: number of trailing lines to return (default 200, max 2000)' },
      },
      required: ['path'],
    },
    async execute(args) {
      const inst = ctx.instance.value
      if (!inst.path) return { error: 'no instance selected' }
      const path = String(args.path ?? '')
      const { key, rest } = resolveVfsPath(path)
      const entry = vfsEntries[key]
      if (!entry?.read) return { error: `unknown path: ${path}` }
      return entry.read(inst.path, rest, args.tailLines)
    },
  })

  tool({
    name: 'vfs_rm',
    description: 'Delete files from the current instance virtual filesystem. Supports client and server mods, resourcepacks, shaderpacks, saves, config files, logs, launch-failure logs, and crash reports. Pass virtual paths such as `mods/foo.jar`, `saves/world`, `config/mod.toml`, `logs/latest.log`, `crash-reports/report.txt`, `server/mods/foo.jar`, or `server/config/mod.toml`. Destructive: confirm with the user before calling. A UI delete interceptor may cancel the operation.',
    parameters: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: 'Virtual file paths to delete' },
      },
      required: ['paths'],
    },
    async execute(args) {
      const paths = Array.isArray(args.paths) ? args.paths.map((p) => String(p)) : []
      if (!paths.length) return { error: 'vfs_rm expects at least one path' }
      const inst = ctx.instance.value.path
      if (!inst) return { error: 'no instance selected' }
      const resolved = paths.map((path) => ({ path, ...resolveVfsPath(path) }))
      const rejected = resolved.filter(({ key, rest }) => !vfsEntries[key]?.remove || !rest)
      if (rejected.length) {
        return { error: `vfs_rm refused unsupported or missing paths: ${rejected.map((p) => p.path).join(', ')}` }
      }
      const approved = await ctx.interceptDelete?.({ instancePath: inst, paths })
      if (approved === false) return { cancelled: true, paths }
      const results: unknown[] = []
      for (const { key, rest } of resolved) {
        results.push(await vfsEntries[key]!.remove!(inst, rest))
      }
      return { ok: true, paths, results }
    },
  })

  // ── Virtual shell: mv (enable/disable) + rm (delete) ──────────────

  function findResourcePack(name: string): InstanceResourcePack | undefined {
    const by = (n: string) => ctx.resourcePacks.value.find((p) => p.id === n || p.fileName === n)
    return by(name) ?? by(stripDisabled(name))
  }
  function findShaderPack(name: string): InstanceShaderFile | undefined {
    const by = (n: string) => ctx.shaderPacks.value.find((s) => s.fileName === n)
    return by(name) ?? by(stripDisabled(name))
  }

  const cliContext = {
    ctx,
    optionsService,
    savesService,
    pathKind,
    stripDisabled,
    modByPathOrId: modByPathOrId,
    findResourcePack,
    findShaderPack,
    summarizeInstallInstruction,
    knownRoutes: KNOWN_ROUTES,
  }
  const instanceAdmin = createInstanceAdminOperations(cliContext, { instanceService, modpackService })
  const helpDomains: Record<string, HelpDomain> = {
    troubleshoot: {
      description: 'Diagnose and repair launch, mod, update, and Java problems.',
      instructions: [
        'Run `diagnose` before `repair` for incomplete or corrupted installations.',
        'Use `diagnose java` before `java install` for invalid, incompatible, or missing Java.',
        'Use `mods deps check`, `mods unused scan` / `mods unused disable`, and `mods updates check` for mod maintenance.',
        'Use `resourcepacks updates check` and `shaderpacks updates check` for pack updates.',
        'Resource changes join the shared list: inspect with `instance change status`, then apply once with `instance change apply`.',
      ],
    },
    server: {
      description: 'Install, configure, diagnose, and launch the current instance local server.',
      instructions: [
        'Read state with `diagnose server`; use `server install`, `server deploy-mods [...]`, and `server eula <accept|revoke>` for setup.',
        'Only accept the EULA after explicit user agreement to https://aka.ms/MinecraftEULA.',
        'Read server files with `vfs_read server/<file>`.',
        'Edit server.properties and allowlisted admin JSON files with `edit_config`; read complete content first and preserve valid JSON.',
        'For an empty server file, use an empty match_string and complete initial replace_string. Never edit eula.txt to bypass confirmation.',
        'Use `launch server` / `kill server`; inspect launch failures or server logs if startup exits.',
      ],
    },
    worlds: {
      description: 'Import, export, clone, link, list, or delete Minecraft worlds.',
      instructions: WORLDS_CLI_INSTRUCTIONS.split('\n'),
    },
    'instance-admin': {
      description: 'Discover versions and create, duplicate, import, or delete instances.',
      instructions: [
        'Use `version list local` for installed versions and `version list minecraft` for remote Minecraft versions.',
        'List loaders with `version list <forge|neoforge> <minecraftVersion>` or `version list <fabric|quilt|optifine|labymod> [minecraftVersion]`.',
        'Version listings support --page and --page-size; remote listings support --refresh.',
        'Use returned values verbatim with `instance create`; see `help instance` for lifecycle syntax.',
        'Deleting an instance is destructive and requires confirmation.',
      ],
    },
    account: {
      description: 'List and switch already-logged-in accounts without handling credentials.',
      instructions: [
        'Use `account list` to list accounts and identify active or expired sessions.',
        'Use `account select <id>` with an exact listed id. It does not perform a new login.',
      ],
    },
  }

  // Each virtual command owns its usage string and argument validation in a
  // separate module. This dispatcher only tokenizes and forwards argv.
  const cliCommands = new Map([
    createMvCommand(cliContext),
    createAccountCommand(cliContext),
    createGrepCommand(cliContext),
    createLaunchCommand(cliContext),
    createKillCommand(cliContext),
    createMarketCommand(cliContext, marketOperations),
    createModsCommand(cliContext),
    createPackCommand(cliContext, 'resourcepacks'),
    createPackCommand(cliContext, 'shaderpacks'),
    createInstanceCommand(cliContext, instanceAdmin),
    createVersionCommand({ metadata: versionMetadataService, versions: versionService }),
    createJavaCommand(cliContext),
    createDiagnoseCommand(cliContext),
    createRepairCommand(cliContext),
    createServerCommand(cliContext),
    createNavigateCommand(cliContext),
    createWorldCommand(cliContext),
  ].map((command) => [command.name, command] as const))
  const helpCommand = createHelpCommand(() => cliCommands.values(), helpDomains)
  cliCommands.set(helpCommand.name, helpCommand)

  tool({
    name: 'bash',
    description: [
      'Run a restricted virtual CLI command over the current instance.',
      '`help`, `help <command>`, and `help domain <name>` provide on-demand command and workflow guidance.',
      '`mv <src> <dest>` toggles `.disabled` for mods, resourcepacks, or shaderpacks.',
      '`grep [-i] <pattern> [config/...]` searches config files.',
      '`launch [client|server]` starts a side; `kill [client|server]` stops it.',
      'Run `help domains` to list available workflow domains.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'A single supported virtual CLI command' },
      },
      required: ['command'],
    },
    async execute(args, signal) {
      const command = String(args.command ?? '').trim()
      if (!command) return { error: 'empty command' }
      const argv = tokenizeCommand(command)
      if (!Array.isArray(argv)) return argv
      const [program, ...rest] = argv
      const cliCommand = cliCommands.get(program)
      if (cliCommand) return cliCommand.execute(rest, signal)
      return { error: `unsupported virtual CLI command: \`${program}\`` }
    },
  })

  // ── Config file editing ────────────────────────────────────────────

  tool({
    name: 'edit_config',
    description: [
      'Edit a client config file under config/, a shader-options virtual config, or an',
      'allowlisted top-level server file under server/ via literal string replacement. Reads the',
      'file, replaces `match_string` with `replace_string`, and writes it back.',
      'Server files: server.properties, ops.json, whitelist.json, banned-players.json,',
      'banned-ips.json, and usercache.json. Every occurrence is replaced unless',
      '`all` is false (then only the first). Fails if `match_string` is not present.',
      'For a missing/empty server file, pass an empty match_string to set its initial content.',
      'Shader paths are shader-options/<vanilla|iris|oculus> with content `shaderPack=<fileName>`; use `shaderPack=` to disable.',
      'Use grep first to locate the exact text, and confirm the change with the user.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Config path, e.g. `config/foo.toml`, `shader-options/iris`, or `server/server.properties`' },
        match_string: { type: 'string', description: 'Exact substring to find (literal, not a regex)' },
        replace_string: { type: 'string', description: 'Replacement text' },
        all: { type: 'boolean', description: 'Replace every occurrence (default true)' },
      },
      required: ['path', 'match_string', 'replace_string'],
    },
    async execute(args) {
      const inst = ctx.instance.value.path
      if (!inst) return { error: 'no instance selected' }
      const p = String(args.path ?? '')
      const { kind, rest } = pathKind(p)
      const serverFile = p.startsWith('server/') ? p.slice('server/'.length) : undefined
      const editableServerFiles = ['server.properties', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json']
      const isServerFile = !!serverFile && editableServerFiles.includes(serverFile)
      const isShaderOptions = kind === 'shader-options' && shaderOptionLoaders.includes(rest as typeof shaderOptionLoaders[number])
      if ((kind !== 'config' || !rest) && !isServerFile && !isShaderOptions) return { error: `edit_config only edits config/, shader-options/, or allowlisted server/ files. Got: ${p}` }
      const match = String(args.match_string ?? '')
      const replacement = String(args.replace_string ?? '')
      const all = args.all === undefined ? true : !!args.all
      let content: string
      try {
        if (isServerFile) content = await optionsService.getServerFile(inst, serverFile)
        else if (isShaderOptions) {
          const options = rest === 'iris'
            ? await optionsService.getIrisShaderOptions(inst)
            : rest === 'oculus'
              ? await optionsService.getOculusShaderOptions(inst)
              : await optionsService.getShaderOptions(inst)
          content = `shaderPack=${options.shaderPack ?? ''}`
        } else content = await optionsService.getInstanceConfig(inst, rest)
      } catch (e) {
        return { error: `cannot read ${p}: ${e instanceof Error ? e.message : String(e)}` }
      }
      if (!match && content) return { error: 'match_string is empty but the target file is not empty' }
      const idx = content.indexOf(match)
      if (idx < 0) return { error: `match_string not found in ${p}` }
      let next: string
      let replaced: number
      if (!match) {
        next = replacement
        replaced = 1
      } else if (all) {
        const parts = content.split(match)
        replaced = parts.length - 1
        next = parts.join(replacement)
      } else {
        replaced = 1
        next = content.slice(0, idx) + replacement + content.slice(idx + match.length)
      }
      if (isServerFile) await optionsService.setServerFile(inst, serverFile, next)
      else if (isShaderOptions) {
        if (!next.startsWith('shaderPack=') || next.includes('\n')) return { error: 'shader-options content must be one line: shaderPack=<fileName>' }
        const options = { instancePath: inst, shaderPack: next.slice('shaderPack='.length) }
        if (rest === 'iris') await optionsService.editIrisShaderOptions(options)
        else if (rest === 'oculus') await optionsService.editOculusShaderOptions(options)
        else await optionsService.editShaderOptions(options)
      } else await optionsService.setInstanceConfig(inst, rest, next)
      return { ok: true, path: p, replaced }
    },
  })

  // ── Instance settings editing ──────────────────────────────────────

  tool({
    name: 'edit_instance',
    description: [
      'Edit the current instance settings (the fields in instance.json). Only the',
      'properties you pass are changed; omitted properties are left untouched, so',
      'read the current values first with `vfs_read instance.json`.',
      'Memory values are in MB. Common fixes: raise `maxMemory` for out-of-memory',
      'crashes, add JVM flags via `vmOptions`, point `java` at a specific runtime',
      'path, set `resolution`, or toggle `fastLaunch` / `showLog`.',
      'To change the Minecraft / mod-loader version, pass `runtime` (see its field',
      'docs). The runtime change is merged over the current one; afterwards run',
      'load the `troubleshoot` pack, then use its diagnose/repair CLI guidance to install the new',
      'version before launching.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance display name' },
        description: { type: 'string', description: 'Instance description' },
        java: { type: 'string', description: 'Absolute path to a java executable; empty string to auto-detect' },
        minMemory: { type: 'number', description: 'Min heap size in MB' },
        maxMemory: { type: 'number', description: 'Max heap size in MB' },
        assignMemory: { description: 'Memory auto-assign policy: true, "auto", or false' },
        vmOptions: { type: 'array', items: { type: 'string' }, description: 'JVM arguments, e.g. ["-XX:+UseG1GC"]' },
        mcOptions: { type: 'array', items: { type: 'string' }, description: 'Minecraft program arguments' },
        env: { type: 'object', description: 'Launch environment variables (string -> string map)' },
        resolution: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            fullscreen: { type: 'boolean' },
          },
          description: 'Game window resolution',
        },
        runtime: {
          type: 'object',
          description: 'Minecraft & mod-loader versions. Merged over the current runtime, so pass only the fields you want to change. Use EXACTLY ONE mod loader: to switch loaders, set the new one and set the others to "" (empty string). When you change the Minecraft version you usually must also pick a loader version built for it. Load the `troubleshoot` pack for diagnose/repair CLI usage.',
          properties: {
            minecraft: { type: 'string', description: 'Minecraft version, e.g. "1.20.1"' },
            forge: { type: 'string', description: 'Forge version (e.g. "47.2.0"); "" to disable' },
            neoForged: { type: 'string', description: 'NeoForge version; "" to disable' },
            fabricLoader: { type: 'string', description: 'Fabric loader version (e.g. "0.16.0"); "" to disable' },
            quiltLoader: { type: 'string', description: 'Quilt loader version; "" to disable' },
            optifine: { type: 'string', description: 'OptiFine version (e.g. "HD_U_I7"); "" to disable' },
            labyMod: { type: 'string', description: 'LabyMod version; "" to disable' },
          },
        },
        fastLaunch: { type: 'boolean', description: 'Skip launch pre-checks for a faster start' },
        showLog: { type: 'boolean', description: 'Show the log window while the game runs' },
        hideLauncher: { type: 'boolean', description: 'Hide the launcher after the game starts' },
        prependCommand: { type: 'string', description: 'Command prepended before the java launch command' },
        preExecuteCommand: { type: 'string', description: 'Command executed before launch' },
      },
    },
    async execute(args) {
      const inst = ctx.instance.value
      const path = inst.path
      if (!path) return { error: 'no instance selected' }
      const editable = [
        'name', 'description', 'java', 'minMemory', 'maxMemory', 'assignMemory',
        'vmOptions', 'mcOptions', 'env', 'resolution', 'fastLaunch', 'showLog',
        'hideLauncher', 'prependCommand', 'preExecuteCommand',
      ] as const
      const payload: Record<string, unknown> = { instancePath: path }
      const edited: string[] = []
      for (const key of editable) {
        if (Object.prototype.hasOwnProperty.call(args, key)) {
          payload[key] = args[key]
          edited.push(key)
        }
      }
      // `runtime` is replaced wholesale by the backend, so merge the requested
      // fields over the current runtime to avoid wiping the others. Reset
      // `version` to '' so the launcher recomputes the version id from the new
      // runtime (otherwise the stale version folder would be launched).
      let runtimeChanged = false
      if (Object.prototype.hasOwnProperty.call(args, 'runtime') && args.runtime && typeof args.runtime === 'object') {
        payload.runtime = { ...inst.runtime, ...(args.runtime as Record<string, unknown>) }
        payload.version = ''
        edited.push('runtime')
        runtimeChanged = true
      }
      if (!edited.length) return { error: 'no editable properties provided' }
      try {
        await instanceService.editInstance(payload as Parameters<typeof instanceService.editInstance>[0])
        return {
          ok: true,
          edited,
          ...(runtimeChanged
            ? { note: 'Runtime changed and version reset. Load the `troubleshoot` pack for diagnose/repair CLI usage before launching.' }
            : {}),
        }
      } catch (e) {
        return { error: `editInstance failed: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  })

  return { base: tools, helpDomains }
}

// ── System prompt ──────────────────────────────────────────────────────

export interface SystemPromptOptions {
  locale: string
  sessionContextMarkdown: string
}

const BASE_RULES = `You are the XMCL (X Minecraft Launcher) assistant. You help the user manage their Minecraft launcher: switching instances, installing or toggling mods / resourcepacks / shaders, launching the game, and diagnosing crashes from logs.

Rules:
- The launcher session context block below is a snapshot taken when the conversation started. If something has changed since then, you will receive a "[launcher event] context changed" message in the chat — trust it over the snapshot.
- Be proactive and take action. When the user reports a problem (a crash, a broken mod setup, a wrong setting) and you can identify a concrete fix, apply it immediately with the tools instead of asking whether you should. Do NOT ask for permission to perform a fix you are confident about — just do it, then briefly report what you changed. Only ask the user first when the choice is genuinely ambiguous (several equally valid options) or you are missing information you cannot obtain yourself.
- Prefer \`vfs_list\` and \`vfs_read\` for exploration. Read current state before editing it.
- Use the \`bash\` virtual CLI for launcher operations. Run \`bash help\` to discover commands, \`bash help <command>\` for exact syntax, and \`bash help domain <name>\` for a detailed workflow. Do not guess command syntax.
- Apply reversible fixes directly. Confirm before destructive or irreversible actions such as deleting files, worlds, or instances, accepting a legal agreement, or killing a running process.
- For failures, inspect the relevant logs or reports, identify the root cause, apply a concrete safe fix when possible, and report what changed. Ask only when the evidence is insufficient or the choice is genuinely ambiguous.`

export function buildSystemPrompt(opts: SystemPromptOptions): string {
  return [
    BASE_RULES,
    `\n\nUser locale: ${opts.locale}. Reply to the user in this language. Keep tool names, paths, mod ids, and JSON arguments in English (do not translate them).`,
    `\n\n${opts.sessionContextMarkdown}`,
  ].join('')
}
