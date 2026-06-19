import type { Instance } from '@xmcl/instance'
import type { GameOptionsState, JavaRecord, UserProfile } from '@xmcl/runtime-api'
import {
  InstanceLogServiceKey,
  InstanceModsServiceKey,
  InstanceOptionsServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceServiceKey,
  InstanceShaderPacksServiceKey,
  LaunchServiceKey,
  ModpackServiceKey,
} from '@xmcl/runtime-api'
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

/**
 * Reactive handles the agent reads at tool-call time. Every field is a `Ref`
 * (or `.value`-bearing computed) so the agent always sees fresh state — the
 * loop is async and instance / mods may change mid-conversation.
 */
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
  saves: Ref<InstanceSaveFile[]>
  gameOptions: Ref<GameOptionsState | undefined>
  /** Diagnosis of the current instance's version install (missing/corrupted files). */
  installInstruction: Ref<InstanceInstallInstruction | undefined>
  /** Download & install whatever the current instance is missing to make it launchable. */
  fixInstanceInstall: () => Promise<void>
  enableResourcePack: (packs: InstanceResourcePack[] | string[]) => Promise<unknown>
  disableResourcePack: (packs: InstanceResourcePack[]) => Promise<unknown>
  selectShaderPack: (fileName: string | undefined) => void
  launch: () => Promise<void>
  killGame: (side?: 'client' | 'server', force?: boolean) => Promise<void>
  // ── Mod maintenance (mirrors the "Mod options" page) ──────────────────
  /** Resolve missing *required* dependencies of the installed mods. */
  checkModDependencies: () => Promise<unknown>
  /** Download & install the dependencies found by {@link checkModDependencies}. */
  installModDependencies: () => Promise<unknown>
  /** Find installed library mods that nothing depends on. */
  scanUnusedMods: () => Promise<unknown>
  /** Disable the unused libraries found by {@link scanUnusedMods}. */
  disableUnusedMods: () => Promise<unknown>
  /** Look up newer versions of the installed mods. */
  checkModUpdates: (opts: { policy?: string; skipVersion?: boolean }) => Promise<unknown>
  /** Apply the updates found by {@link checkModUpdates}. */
  applyModUpdates: () => Promise<unknown>
  // ── Java ──────────────────────────────────────────────────────────────
  /** All Java runtimes the launcher knows about. */
  javaList: Ref<JavaRecord[]>
  /** Current instance Java problem, if any (`invalid` / `incompatible`). */
  javaIssue: Ref<'invalid' | 'incompatible' | undefined>
  /** Install the Java runtime the current instance requires. */
  installJava: () => Promise<unknown>
}

// ── Shape helpers ──────────────────────────────────────────────────────
// Trim fat fields (icon data URLs, full description, parsed manifests) so the
// LLM context stays small. The agent can always ask for a specific file by
// path if it needs more detail.

function trimInstance(i: Instance) {
  return {
    path: i.path,
    name: i.name,
    runtime: i.runtime,
    version: i.version,
    java: i.java,
    server: i.server,
    description: i.description,
    lastPlayed: i.lastPlayedDate,
    playtime: i.playtime,
  }
}

function trimMod(m: ModFile) {
  return {
    modId: m.modId,
    name: m.name,
    version: m.version,
    fileName: m.fileName,
    path: m.path,
    enabled: m.enabled,
    loaders: m.modLoaders,
    description: m.description?.slice(0, 200),
  }
}

function trimResourcePack(p: InstanceResourcePack) {
  return {
    id: p.id,
    name: p.name,
    fileName: p.fileName,
    enabled: p.enabled,
    path: p.path,
    acceptingRange: p.acceptingRange,
  }
}

function trimShaderPack(s: InstanceShaderFile) {
  return {
    fileName: s.fileName,
    path: s.path,
    enabled: s.enabled,
  }
}

function trimSave(s: InstanceSaveFile) {
  return {
    name: s.name,
    path: s.path,
    enabled: s.enabled,
    levelName: s.levelName,
    gameVersion: s.gameVersion,
    lastPlayed: s.lastPlayed,
  }
}

/**
 * Condense the (potentially huge) install diagnosis into a small, LLM-friendly
 * shape: a human-readable list of issues plus the raw counts. Heavy arrays
 * (full library / asset lists) are reduced to counts so the context stays tiny.
 */
function summarizeInstallInstruction(inst: InstanceInstallInstruction | undefined) {
  if (!inst) {
    return { available: false, note: 'No diagnosis available yet (no instance selected or version not resolved).' }
  }
  const missingLibraries = inst.libraries?.length ?? 0
  const missingAssets = inst.assets?.length ?? 0
  const issues: string[] = []
  const resolved = !!inst.resolvedVersion
  if (!resolved) issues.push('version not resolved — core game files are likely not installed')
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

// ── Routes recognised by `navigate` ─────────────────────────────────────
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

type AssetKind = 'mods' | 'resourcepacks' | 'shaderpacks' | 'saves' | 'logs' | 'crash-reports' | 'launch-failures' | 'config'

function pathKind(path: string): { kind: AssetKind | 'instance.json' | 'options.txt' | 'root'; rest: string } {
  const clean = path.replace(/^\.?\/+/, '').replace(/\/+$/, '')
  if (!clean) return { kind: 'root', rest: '' }
  if (clean === 'instance.json') return { kind: 'instance.json', rest: '' }
  if (clean === 'options.txt') return { kind: 'options.txt', rest: '' }
  const [head, ...rest] = clean.split('/')
  if (head === 'mods' || head === 'resourcepacks' || head === 'shaderpacks' || head === 'saves' || head === 'logs' || head === 'crash-reports' || head === 'launch-failures' || head === 'config') {
    return { kind: head, rest: rest.join('/') }
  }
  return { kind: 'root', rest: clean }
}

// ── Factory ─────────────────────────────────────────────────────────────

export interface ToolRegistry {
  /** Tools always exposed to the LLM. */
  base: Tool[]
  /**
   * Lazy tool packs the agent can load on demand via `load_tools`. Keys
   * appear in the system prompt so the model knows what is available.
   */
  loadable: Record<string, { description: string; load: () => Promise<Tool[]> }>
}

export function createXmclTools(ctx: AgentContext): ToolRegistry {
  const instanceMods = useService(InstanceModsServiceKey)
  const launchService = useService(LaunchServiceKey)
  const logService = useService(InstanceLogServiceKey)
  const resourcePackService = useService(InstanceResourcePacksServiceKey)
  const shaderPackService = useService(InstanceShaderPacksServiceKey)
  const modpackService = useService(ModpackServiceKey)
  const optionsService = useService(InstanceOptionsServiceKey)
  const instanceService = useService(InstanceServiceKey)

  const tools: Tool[] = []
  const tool = (t: Tool) => { tools.push(t) }

  function modByPathOrId(needle: string): ModFile | undefined {
    return ctx.mods.value.find((m) => m.path === needle || m.fileName === needle || m.modId === needle)
  }

  // ── Context (read) ──────────────────────────────────────────────────

  tool({
    name: 'list_instances',
    description: 'List all known instances (path, name, runtime). The currently selected instance is reported in the system prompt; use this only to find others.',
    readonly: true,
    parameters: { type: 'object', properties: {} },
    async execute() {
      return ctx.instances.value.map(trimInstance)
    },
  })

  tool({
    name: 'select_instance',
    description: 'Switch the currently selected instance by its path.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Instance path' } },
      required: ['path'],
    },
    async execute(args) {
      const path = String(args.path ?? '')
      if (!ctx.instances.value.some((i) => i.path === path)) {
        return { error: `instance not found: ${path}` }
      }
      ctx.selectedInstancePath.value = path
      return { ok: true, path }
    },
  })

  // ── Virtual FS ──────────────────────────────────────────────────────

  tool({
    name: 'vfs_list',
    description: 'List entries under a virtual directory rooted at the current instance. Known directories: `mods`, `resourcepacks`, `shaderpacks`, `saves`, `logs`, `crash-reports`, `config`. Use `""` or `"."` for the root.',
    readonly: true,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative directory path' } },
    },
    async execute(args) {
      const path = String(args.path ?? '')
      const { kind } = pathKind(path)
      const inst = ctx.instance.value
      if (!inst.path) return { error: 'no instance selected' }

      if (kind === 'root') {
        const entries: VfsEntry[] = [
          { type: 'dir', name: 'mods', description: `${ctx.mods.value.length} mods (${ctx.mods.value.filter((m) => m.enabled).length} enabled)` },
          { type: 'dir', name: 'resourcepacks', description: `${ctx.resourcePacks.value.length} packs` },
          { type: 'dir', name: 'shaderpacks', description: `${ctx.shaderPacks.value.length} packs${ctx.selectedShaderPack.value ? `, active: ${ctx.selectedShaderPack.value}` : ''}` },
          { type: 'dir', name: 'saves', description: `${ctx.saves.value.length} worlds` },
          { type: 'dir', name: 'logs', description: 'minecraft log files' },
          { type: 'dir', name: 'crash-reports', description: 'minecraft crash reports' },
          { type: 'dir', name: 'launch-failures', description: 'launcher-captured abnormal-exit dumps (xmcl-abnormal-exit-*)' },
          { type: 'dir', name: 'config', description: 'mod config files (grep / edit_config)' },
          { type: 'file', name: 'instance.json', description: 'full launcher instance settings' },
          { type: 'file', name: 'options.txt', description: 'parsed minecraft options.txt' },
        ]
        return { path: inst.path, entries }
      }

      if (kind === 'mods') {
        return ctx.mods.value.map((m) => ({
          type: 'file' as const,
          name: m.fileName,
          path: m.path,
          enabled: m.enabled,
          modId: m.modId,
          version: m.version,
          loaders: m.modLoaders,
        }))
      }
      if (kind === 'resourcepacks') return ctx.resourcePacks.value.map(trimResourcePack)
      if (kind === 'shaderpacks') {
        return {
          selected: ctx.selectedShaderPack.value,
          entries: ctx.shaderPacks.value.map(trimShaderPack),
        }
      }
      if (kind === 'saves') return ctx.saves.value.map(trimSave)
      if (kind === 'logs') return await logService.listLogs(inst.path)
      if (kind === 'crash-reports') return await logService.listCrashReports(inst.path)
      if (kind === 'launch-failures') return await logService.listLaunchFailures(inst.path)
      if (kind === 'config') {
        const files = await optionsService.getInstanceConfigFiles(inst.path)
        return files.map((f) => ({ type: 'file' as const, name: f, path: `config/${f}` }))
      }
      return { error: `not a directory: ${path}` }
    },
  })

  tool({
    name: 'vfs_read',
    description: 'Read a virtual file. Examples: `instance.json` (full instance settings), `options.txt` (parsed game options), `mods/<fileName>` (mod metadata), `resourcepacks/<id>` (pack metadata), `shaderpacks/<fileName>`, `saves/<name>`, `logs/<name>` (last 200 lines by default), `crash-reports/<name>`, `config/<file>` (raw config text).',
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
      const { kind, rest } = pathKind(path)

      if (kind === 'instance.json') return inst
      if (kind === 'options.txt') return ctx.gameOptions.value ?? { error: 'options.txt not loaded yet' }
      if (kind === 'mods') {
        const m = modByPathOrId(rest)
        if (!m) return { error: `mod not found: ${rest}` }
        return trimMod(m)
      }
      if (kind === 'resourcepacks') {
        const p = ctx.resourcePacks.value.find((p) => p.id === rest || p.fileName === rest)
        if (!p) return { error: `resourcepack not found: ${rest}` }
        return trimResourcePack(p)
      }
      if (kind === 'shaderpacks') {
        const s = ctx.shaderPacks.value.find((s) => s.fileName === rest)
        if (!s) return { error: `shaderpack not found: ${rest}` }
        return trimShaderPack(s)
      }
      if (kind === 'saves') {
        const s = ctx.saves.value.find((s) => s.name === rest || s.path === rest)
        if (!s) return { error: `save not found: ${rest}` }
        return trimSave(s)
      }
      if (kind === 'logs') {
        const full = await logService.getLogContent(inst.path, rest)
        const tail = Math.min(Number(args.tailLines ?? 200) || 200, 2000)
        const lines = full.split('\n')
        return lines.length > tail ? lines.slice(-tail).join('\n') : full
      }
      if (kind === 'crash-reports') return await logService.getCrashReportContent(inst.path, rest)
      if (kind === 'config') {
        if (!rest) return { error: 'config is a directory; use vfs_list or grep' }
        try {
          return await optionsService.getInstanceConfig(inst.path, rest)
        } catch (e) {
          return { error: `cannot read config/${rest}: ${e instanceof Error ? e.message : String(e)}` }
        }
      }
      if (kind === 'launch-failures') {
        // Stored as a log file in the same `logs/` folder, just with a fixed
        // prefix — so we read it the same way.
        const full = await logService.getLogContent(inst.path, rest)
        const tail = Math.min(Number(args.tailLines ?? 200) || 200, 2000)
        const lines = full.split('\n')
        return lines.length > tail ? lines.slice(-tail).join('\n') : full
      }
      return { error: `unknown path: ${path}` }
    },
  })

  // ── Virtual shell: mv (enable/disable) + rm (delete) ──────────────

  function findMod(name: string): ModFile | undefined {
    return modByPathOrId(name) ?? modByPathOrId(stripDisabled(name))
  }
  function findResourcePack(name: string): InstanceResourcePack | undefined {
    const by = (n: string) => ctx.resourcePacks.value.find((p) => p.id === n || p.fileName === n)
    return by(name) ?? by(stripDisabled(name))
  }
  function findShaderPack(name: string): InstanceShaderFile | undefined {
    const by = (n: string) => ctx.shaderPacks.value.find((s) => s.fileName === n)
    return by(name) ?? by(stripDisabled(name))
  }

  // `mv <src> <dest>` is the enable/disable primitive. A file is considered
  // disabled when its name carries a trailing `.disabled` suffix, so toggling
  // state is just a rename. Mods rename on disk; resourcepacks/shaderpacks are
  // toggled through their own services but expose the same contract.
  async function runMv(argv: string[]) {
    const positionals = argv.filter((a) => !a.startsWith('-'))
    if (positionals.length !== 2) {
      return { error: `mv expects exactly 2 paths: \`mv <src> <dest>\` (got ${positionals.length})` }
    }
    const [src, dest] = positionals
    const s = pathKind(src)
    const d = pathKind(dest)
    if (s.kind !== d.kind) {
      return { error: `mv cannot move across directories (${s.kind} -> ${d.kind})` }
    }
    if (s.kind !== 'mods' && s.kind !== 'resourcepacks' && s.kind !== 'shaderpacks') {
      return { error: `mv only operates under mods/, resourcepacks/, shaderpacks/ (the enable/disable protocol). Got: ${src}` }
    }
    if (stripDisabled(s.rest) !== stripDisabled(d.rest)) {
      return { error: 'mv may only toggle the `.disabled` suffix to enable/disable a file; renaming to a different name is not supported.' }
    }
    const srcDisabled = s.rest.endsWith(DISABLED_SUFFIX)
    const dstDisabled = d.rest.endsWith(DISABLED_SUFFIX)
    if (srcDisabled === dstDisabled) {
      return { error: 'mv is a no-op: append `.disabled` to disable, or strip it to enable.' }
    }
    const enabling = !dstDisabled
    const inst = ctx.instance.value.path
    if (!inst) return { error: 'no instance selected' }

    if (s.kind === 'mods') {
      const mod = findMod(s.rest)
      if (!mod) return { error: `mod not found: ${s.rest}` }
      if (enabling) await instanceMods.enable({ path: inst, files: [mod.path] })
      else await instanceMods.disable({ path: inst, files: [mod.path] })
      return { ok: true, action: enabling ? 'enabled' : 'disabled', mod: mod.fileName }
    }
    if (s.kind === 'resourcepacks') {
      const pack = findResourcePack(s.rest)
      if (!pack) return { error: `resourcepack not found: ${s.rest}` }
      if (enabling) await ctx.enableResourcePack([pack])
      else await ctx.disableResourcePack([pack])
      return { ok: true, action: enabling ? 'enabled' : 'disabled', resourcepack: pack.fileName }
    }
    const shader = findShaderPack(s.rest)
    if (!shader) return { error: `shaderpack not found: ${s.rest}` }
    if (enabling) ctx.selectShaderPack(shader.fileName)
    else if (ctx.selectedShaderPack.value === shader.fileName) ctx.selectShaderPack(undefined)
    return { ok: true, action: enabling ? 'enabled' : 'disabled', shaderpack: shader.fileName }
  }

  // `rm <path...>` deletes files. Only the three resource folders are
  // deletable — anything else is refused so the model cannot wipe configs,
  // logs, or the instance manifest without explicit user action in the UI.
  async function runRm(argv: string[]) {
    const positionals = argv.filter((a) => !a.startsWith('-'))
    if (!positionals.length) return { error: 'rm expects at least one path' }
    const inst = ctx.instance.value.path
    if (!inst) return { error: 'no instance selected' }
    const mods: string[] = []
    const rps: string[] = []
    const sps: string[] = []
    const rejected: string[] = []
    for (const p of positionals) {
      const { kind, rest } = pathKind(p)
      const id = rest || p
      if (kind === 'mods') {
        mods.push(findMod(id)?.path ?? id)
      } else if (kind === 'resourcepacks') {
        const found = findResourcePack(id)
        if (found?.path) rps.push(found.path)
        else rejected.push(p)
      } else if (kind === 'shaderpacks') {
        const found = findShaderPack(id)
        if (found?.path) sps.push(found.path)
        else rejected.push(p)
      } else {
        rejected.push(p)
      }
    }
    if (rejected.length) {
      // Refuse the whole command so nothing is half-deleted. Deleting paths
      // outside the resource folders needs explicit approval from the user.
      return { error: `rm refused. Only files under mods/, resourcepacks/, shaderpacks/ may be deleted; deleting any other path requires the user to confirm in the launcher UI. Rejected: ${rejected.join(', ')}` }
    }
    if (mods.length) await instanceMods.uninstall({ path: inst, files: mods })
    if (rps.length) await resourcePackService.uninstall({ path: inst, files: rps })
    if (sps.length) await shaderPackService.uninstall({ path: inst, files: sps })
    return { ok: true, deleted: { mods: mods.length, resourcepacks: rps.length, shaderpacks: sps.length } }
  }

  // `grep [-i] <pattern> [config/...]` searches config files for a regex.
  // Scoped to the config/ tree so the model can inspect mod configuration
  // without pulling whole files into context. With no path it scans every
  // config file; a directory prefix (e.g. `config/foo`) narrows the search.
  async function runGrep(argv: string[]) {
    let ignoreCase = false
    const positionals: string[] = []
    for (const a of argv) {
      if (a.startsWith('-') && a.length > 1) {
        if (a.includes('i')) ignoreCase = true
      } else {
        positionals.push(a)
      }
    }
    if (!positionals.length) {
      return { error: 'grep expects a pattern: `grep <pattern> [config/...]`' }
    }
    const [pattern, ...paths] = positionals
    let re: RegExp
    try {
      re = new RegExp(pattern, ignoreCase ? 'i' : '')
    } catch (e) {
      return { error: `invalid grep pattern: ${e instanceof Error ? e.message : String(e)}` }
    }
    const inst = ctx.instance.value.path
    if (!inst) return { error: 'no instance selected' }

    const prefixes: string[] = []
    for (const p of (paths.length ? paths : ['config'])) {
      const { kind, rest } = pathKind(p)
      if (kind !== 'config') {
        return { error: `grep only searches files under config/. Got: ${p}` }
      }
      prefixes.push(rest)
    }
    const allFiles = await optionsService.getInstanceConfigFiles(inst).catch(() => [] as string[])
    const selected = new Set<string>()
    for (const prefix of prefixes) {
      if (!prefix) { allFiles.forEach((f) => selected.add(f)); continue }
      for (const f of allFiles) {
        if (f === prefix || f.startsWith(prefix + '/')) selected.add(f)
      }
    }
    if (!selected.size) return { matches: [], note: 'no matching config files' }

    const MAX_MATCHES = 200
    const matches: { file: string; line: number; text: string }[] = []
    let truncated = false
    for (const rel of selected) {
      let content: string
      try {
        content = await optionsService.getInstanceConfig(inst, rel)
      } catch {
        continue
      }
      if (content.length > 512 * 1024) continue
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          matches.push({ file: `config/${rel}`, line: i + 1, text: lines[i].slice(0, 400) })
          if (matches.length >= MAX_MATCHES) { truncated = true; break }
        }
      }
      if (truncated) break
    }
    return truncated ? { matches, truncated: true } : { matches }
  }

  tool({
    name: 'bash',
    description: [
      'Run a restricted shell command over the current instance virtual filesystem.',
      'Only three programs are supported — anything else is rejected:',
      '',
      '`mv <src> <dest>` — rename a file. This is how you enable/disable content.',
      '  A file is DISABLED when its name ends with `.disabled`.',
      '  - disable: `mv mods/foo.jar mods/foo.jar.disabled`',
      '  - enable:  `mv mods/foo.jar.disabled mods/foo.jar`',
      '  Works under mods/, resourcepacks/, shaderpacks/. Only the `.disabled`',
      '  suffix may change — you cannot rename to a different base name.',
      '  Shaderpacks are exclusive: enabling one disables the active pack.',
      '',
      '`rm <path...>` — delete files. Only paths under mods/, resourcepacks/,',
      '  shaderpacks/ are allowed (e.g. `rm mods/foo.jar resourcepacks/bar`).',
      '  Deleting any other path is refused. Confirm with the user first.',
      '',
      '`grep [-i] <pattern> [config/...]` — search config files for a regex',
      '  (`-i` = case-insensitive). Only searches under config/. With no path it',
      '  scans every config file; pass `config/sub` or `config/foo.toml` to narrow.',
      '  Returns matching {file, line, text}. Use this before edit_config.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'A single `mv`, `rm`, or `grep` command' },
      },
      required: ['command'],
    },
    async execute(args) {
      const command = String(args.command ?? '').trim()
      if (!command) return { error: 'empty command' }
      const argv = tokenizeCommand(command)
      if (!Array.isArray(argv)) return argv
      const [program, ...rest] = argv
      if (program === 'mv') return runMv(rest)
      if (program === 'rm') return runRm(rest)
      if (program === 'grep') return runGrep(rest)
      return { error: `unsupported command: \`${program}\`. Only \`mv\`, \`rm\`, and \`grep\` are allowed.` }
    },
  })

  // ── Config file editing ────────────────────────────────────────────

  tool({
    name: 'edit_config',
    description: [
      'Edit a config file under config/ via literal string replacement. Reads the',
      'file, replaces `match_string` with `replace_string`, and writes it back.',
      'Only files under config/ may be edited. Every occurrence is replaced unless',
      '`all` is false (then only the first). Fails if `match_string` is not present.',
      'Use grep first to locate the exact text, and confirm the change with the user.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Config file path, e.g. `config/foo.toml`' },
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
      if (kind !== 'config' || !rest) {
        return { error: `edit_config only edits files under config/. Got: ${p}` }
      }
      const match = String(args.match_string ?? '')
      if (!match) return { error: 'match_string is empty' }
      const replacement = String(args.replace_string ?? '')
      const all = args.all === undefined ? true : !!args.all
      let content: string
      try {
        content = await optionsService.getInstanceConfig(inst, rest)
      } catch (e) {
        return { error: `cannot read config/${rest}: ${e instanceof Error ? e.message : String(e)}` }
      }
      const idx = content.indexOf(match)
      if (idx < 0) return { error: `match_string not found in config/${rest}` }
      let next: string
      let replaced: number
      if (all) {
        const parts = content.split(match)
        replaced = parts.length - 1
        next = parts.join(replacement)
      } else {
        replaced = 1
        next = content.slice(0, idx) + replacement + content.slice(idx + match.length)
      }
      await optionsService.setInstanceConfig(inst, rest, next)
      return { ok: true, path: `config/${rest}`, replaced }
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
      'This does NOT change the Minecraft / mod-loader version (`runtime`) — that',
      'needs a reinstall and is out of scope here.',
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
        fastLaunch: { type: 'boolean', description: 'Skip launch pre-checks for a faster start' },
        showLog: { type: 'boolean', description: 'Show the log window while the game runs' },
        hideLauncher: { type: 'boolean', description: 'Hide the launcher after the game starts' },
        prependCommand: { type: 'string', description: 'Command prepended before the java launch command' },
        preExecuteCommand: { type: 'string', description: 'Command executed before launch' },
      },
    },
    async execute(args) {
      const path = ctx.instance.value.path
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
      if (!edited.length) return { error: 'no editable properties provided' }
      try {
        await instanceService.editInstance(payload as Parameters<typeof instanceService.editInstance>[0])
        return { ok: true, edited }
      } catch (e) {
        return { error: `editInstance failed: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  })

  // ── Install from market URIs ───────────────────────────────────────
  // The `install` tool lives in the lazy `market` pack (see marketTools.ts)
  // alongside the Modrinth / CurseForge search & metadata tools.

  // ── Instance install (diagnose / repair) ────────────────────────────

  tool({
    name: 'diagnose_instance',
    description: 'Diagnose the current instance\'s version installation: detect a missing or corrupted Minecraft jar, libraries, assets, asset index, mod loader (Forge / NeoForge / OptiFine install profile) or a required Java that is not installed. Returns `healthy: true` when nothing is wrong, otherwise a list of `issues`. Run this when a launch fails, the user reports missing files, or before repairing.',
    readonly: true,
    parameters: { type: 'object', properties: {} },
    async execute() {
      if (!ctx.instance.value.path) return { error: 'no instance selected' }
      return summarizeInstallInstruction(ctx.installInstruction.value)
    },
  })

  tool({
    name: 'repair_instance',
    description: 'Download and install whatever the current instance is missing (Minecraft jar, libraries, assets, mod loader, required Java) so it becomes launchable. Safe and idempotent — a no-op when nothing is missing. Use it to fix launch failures caused by an incomplete or corrupted installation. Returns the diagnosis before and after the repair so you can confirm it worked.',
    parameters: { type: 'object', properties: {} },
    async execute() {
      if (!ctx.instance.value.path) return { error: 'no instance selected' }
      const before = summarizeInstallInstruction(ctx.installInstruction.value)
      if (before.available && before.healthy) {
        return { ok: true, alreadyHealthy: true, note: 'Nothing to install — the instance is already complete.' }
      }
      await ctx.fixInstanceInstall()
      const after = summarizeInstallInstruction(ctx.installInstruction.value)
      return { ok: true, before, after }
    },
  })

  // ── Navigation ───────────────────────────────────────────────────────

  tool({
    name: 'navigate',
    description: `Navigate the UI to a route. Known routes: ${KNOWN_ROUTES.join(', ')}.`,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', enum: [...KNOWN_ROUTES] } },
      required: ['path'],
    },
    async execute(args) {
      const path = String(args.path ?? '')
      if (!KNOWN_ROUTES.includes(path as typeof KNOWN_ROUTES[number])) {
        return { error: `unknown route: ${path}` }
      }
      await ctx.router.push(path)
      return { ok: true, path }
    },
  })

  // ── Launch / runtime ─────────────────────────────────────────────────

  tool({
    name: 'launch_game',
    description: 'Launch the current instance with the active user. Returns once the launch handshake completes.',
    parameters: { type: 'object', properties: {} },
    async execute() {
      await ctx.launch()
      return { ok: true }
    },
  })

  tool({
    name: 'kill_game',
    description: 'Kill the running Minecraft client for the current instance.',
    parameters: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Force-terminate the process tree' },
      },
    },
    async execute(args) {
      await ctx.killGame('client', !!args.force)
      return { ok: true }
    },
  })

  tool({
    name: 'list_game_processes',
    description: 'List Minecraft processes the launcher is tracking globally.',
    readonly: true,
    parameters: { type: 'object', properties: {} },
    async execute() {
      const procs = await launchService.getGameProcesses()
      return procs.map((p) => ({
        pid: p.pid,
        side: p.side,
        ready: p.ready,
        gameDirectory: p.options.gameDirectory,
        version: p.options.version,
      }))
    },
  })

  // ── Lazy-loadable packs ─────────────────────────────────────────────

  const loadable: ToolRegistry['loadable'] = {
    market: {
      description: 'Search Modrinth & CurseForge for mods / resourcepacks / shaderpacks / modpacks, read project descriptions and versions, and `install` them into the current instance. Load this when the user wants to find or add new content.',
      async load() {
        const m = await import('./marketTools')
        return m.createMarketTools(ctx, { instanceMods, resourcePackService, shaderPackService, modpackService })
      },
    },
    mod_maintenance: {
      description: 'Inspect & fix mod problems: find missing required dependencies and install them, scan for unused library mods and disable them, and check for / apply mod updates. Load this when diagnosing a crash that may be caused by a missing dependency or an outdated mod, or to clean up unused libraries.',
      async load() {
        const m = await import('./modMaintenanceTools')
        return m.createModMaintenanceTools(ctx)
      },
    },
    java: {
      description: 'Diagnose the instance Java (compatibility / validity) and install a compatible Java runtime. Load this when the game fails to launch or crashes because of a wrong, invalid, or missing Java version.',
      async load() {
        const m = await import('./javaTools')
        return m.createJavaTools(ctx)
      },
    },
  }

  return { base: tools, loadable }
}

// ── System prompt ──────────────────────────────────────────────────────

export interface SystemPromptOptions {
  locale: string
  sessionContextMarkdown: string
  loadable: Record<string, { description: string }>
}

const BASE_RULES = `You are the XMCL (X Minecraft Launcher) assistant. You help the user manage their Minecraft launcher: switching instances, installing or toggling mods / resourcepacks / shaders, launching the game, and diagnosing crashes from logs.

Rules:
- The launcher session context block below is a snapshot taken when the conversation started. If something has changed since then, you will receive a "[launcher event] context changed" message in the chat — trust it over the snapshot.
- Be proactive and take action. When the user reports a problem (a crash, a broken mod setup, a wrong setting) and you can identify a concrete fix, apply it immediately with the tools instead of asking whether you should. Do NOT ask for permission to perform a fix you are confident about — just do it, then briefly report what you changed. Only ask the user first when the choice is genuinely ambiguous (several equally valid options) or you are missing information you cannot obtain yourself.
- Prefer the virtual filesystem tools (vfs_list, vfs_read) for exploration. \`instance.json\` returns the full instance settings; \`options.txt\` returns parsed Minecraft options.
- To change instance settings (memory, JVM args, java path, resolution, window/launch flags, name/description), use \`edit_instance\` — pass only the properties you want to change. Read \`vfs_read instance.json\` first to see current values. Memory is in MB. For out-of-memory crashes, raise \`maxMemory\` (and \`minMemory\`) or add JVM flags via \`vmOptions\`. \`edit_instance\` does not change the Minecraft / mod-loader version.
- To enable or disable a mod / resourcepack / shaderpack, use the \`bash\` tool with \`mv\` to toggle a trailing \`.disabled\` suffix on its virtual path: appending \`.disabled\` disables it, stripping the suffix enables it. e.g. \`mv mods/foo.jar mods/foo.jar.disabled\` (disable) or \`mv mods/foo.jar.disabled mods/foo.jar\` (enable). Shaderpacks are exclusive — enabling one disables the previously active pack.
- To delete a mod / resourcepack / shaderpack, use the \`bash\` tool with \`rm\` on its virtual path (e.g. \`rm mods/foo.jar resourcepacks/bar\`). \`rm\` only works under \`mods/\`, \`resourcepacks/\`, \`shaderpacks/\`; deleting any other path is refused.
- To add new content, load the \`market\` pack: find projects with \`modrinth_search\` / \`curseforge_search\`, then \`install\` with a target and market URIs (\`modrinth:projId:verId\`, \`curseforge:projId:fileId\`).
- If the game fails to launch or files look missing/corrupted, run \`diagnose_instance\` to inspect the instance's version installation, then \`repair_instance\` to download and install whatever is missing (Minecraft jar, libraries, assets, mod loader, required Java). \`repair_instance\` is safe and idempotent — prefer it over telling the user to reinstall manually.
- When a crash or launch failure looks mod-related, load the \`mod_maintenance\` pack: \`check_mod_dependencies\` finds missing *required* dependencies (a very common crash cause) and \`install_mod_dependencies\` adds them; \`check_mod_updates\` / \`apply_mod_updates\` upgrade outdated mods; \`scan_unused_mods\` / \`disable_unused_mods\` clean up orphan libraries. Always run the matching check before applying.
- When the failure looks Java-related (wrong major version, invalid runtime, or the snapshot shows the Java is \`mismatch\`), load the \`java\` pack: \`diagnose_java\` reports the problem and \`install_java\` downloads a compatible runtime, which the instance then auto-selects.
- Mod config files live under \`config/\`. Browse with \`vfs_list config\`, read with \`vfs_read config/<file>\`, search across them via the \`bash\` tool's \`grep [-i] <pattern> [config/...]\`, and modify them with \`edit_config\` (literal \`match_string\` -> \`replace_string\`). Only \`config/\` files can be searched or edited this way.
- For UI navigation, only use the routes exposed by the navigate tool.
- Reversible fixes — toggling content with \`mv\`, installing content or missing dependencies (the \`market\` / \`mod_maintenance\` packs), repairing a broken installation with \`repair_instance\`, editing instance settings with \`edit_instance\`, and editing config with \`edit_config\` — are safe: perform them directly without asking. Only pause to confirm before truly destructive or irreversible actions: deleting files (\`rm\`) or killing a running game (kill_game).
- For crash analysis: read the most recent crash report or launch failure, determine the root cause, then directly apply the fix when you know it (e.g. re-enable a disabled dependency, install a missing or conflicting mod, correct a config value, or run \`repair_instance\` when the install is incomplete/corrupted). Afterwards report the root cause and exactly what you changed. Only stop to ask if you genuinely cannot determine a safe fix on your own.`

export function buildSystemPrompt(opts: SystemPromptOptions): string {
  const loadablePacks = Object.entries(opts.loadable)
    .map(([name, { description }]) => `- \`${name}\` — ${description}`)
    .join('\n')
  const loadableSection = loadablePacks
    ? `\n\nLazy-loaded tool packs (call \`load_tools\` with the names you need; the new tools become available the next turn):\n${loadablePacks}`
    : ''

  return [
    BASE_RULES,
    `\n\nUser locale: ${opts.locale}. Reply to the user in this language. Keep tool names, paths, mod ids, and JSON arguments in English (do not translate them).`,
    loadableSection,
    `\n\n${opts.sessionContextMarkdown}`,
  ].join('')
}
