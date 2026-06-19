import type { Instance } from '@xmcl/instance'
import type { InstanceJavaStatus } from '../instanceJava'
import type { InstanceResolveVersion } from '../instanceVersion'
import { isResolvedVersion } from '../instanceVersion'

/**
 * Snapshot of the user's launcher state taken when an agent session starts.
 *
 * The snapshot is frozen at conversation start so subsequent reads do not
 * re-balloon the prompt. Mid-session deltas (e.g. resolved version changed
 * because a `forge` install finished) are surfaced through {@link buildChangeEvent}
 * which the loop pushes as an extra `user`-role message.
 */
export interface SessionContext {
  locale: string
  username: string
  userType: string
  instancePath: string
  instanceName: string
  runtime: Record<string, string | undefined>
  side: 'client' | 'server'
  resolvedVersion: ResolvedVersionSnapshot
  resolvedJava: ResolvedJavaSnapshot
  fileTree: FileTreeSummary
}

export interface ResolvedVersionSnapshot {
  resolved: boolean
  id?: string
  minecraftVersion?: string
  mainClass?: string
  assetIndex?: string
  librariesCount?: number
  missingRuntimes?: Record<string, string>
}

export interface ResolvedJavaSnapshot {
  resolved: boolean
  path?: string
  version?: string
  majorVersion?: number
  compatibility?: 'matched' | 'mismatch' | 'unknown' | string
}

export interface FileTreeSummary {
  modsTotal: number
  modsEnabled: number
  resourcePacksTotal: number
  resourcePacksEnabled: number
  shaderPacksTotal: number
  shaderSelected?: string
  savesTotal: number
  logsTotal: number
  crashReportsTotal: number
}

// ── Snapshot builders ───────────────────────────────────────────────────

export function snapshotVersion(v: InstanceResolveVersion | undefined): ResolvedVersionSnapshot {
  if (!v) return { resolved: false }
  if (isResolvedVersion(v)) {
    return {
      resolved: true,
      id: v.id,
      minecraftVersion: v.minecraftVersion,
      mainClass: v.mainClass,
      assetIndex: v.assets,
      librariesCount: v.libraries.length,
    }
  }
  return {
    resolved: false,
    missingRuntimes: { ...v.requirements },
    id: v.version,
  }
}

export function snapshotJava(s: InstanceJavaStatus | undefined): ResolvedJavaSnapshot {
  if (!s) return { resolved: false }
  // `compatible` is a number enum on InstanceJavaStatus; map it to a label.
  let compat: string | undefined
  if (s.compatible !== undefined) {
    // 0=matched, 1=mismatch (best-effort label without dragging the enum here)
    compat = s.compatible === 0 ? 'matched' : s.compatible === 1 ? 'mismatch' : String(s.compatible)
  }
  return {
    resolved: !!s.java,
    path: s.java?.path,
    version: s.java?.version,
    majorVersion: s.java?.majorVersion,
    compatibility: compat,
  }
}

export function trimRuntime(rt: Instance['runtime']): Record<string, string | undefined> {
  // Drop empty loader versions so the prompt stays compact.
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(rt)) {
    if (v && String(v).trim()) out[k] = String(v)
  }
  return out
}

// ── Pretty-printers ────────────────────────────────────────────────────

function fileLine(name: string, summary: string): string {
  // Align the dash so the tree is easy to skim. 28 = widest expected name.
  const pad = ' '.repeat(Math.max(1, 28 - name.length))
  return `  ${name}${pad}— ${summary}`
}

function fmtVersion(v: ResolvedVersionSnapshot): string {
  if (!v.resolved) {
    const target = v.id ? ` (target ${v.id})` : ''
    const missing = v.missingRuntimes
      ? ` missing: ${Object.entries(v.missingRuntimes).map(([k, val]) => `${k}=${val}`).join(', ')}`
      : ''
    return `unresolved${target}${missing}`
  }
  const libs = v.librariesCount !== undefined ? `, ${v.librariesCount} libraries` : ''
  return `${v.id} (mc ${v.minecraftVersion}, main ${v.mainClass}${libs})`
}

function fmtJava(j: ResolvedJavaSnapshot): string {
  if (!j.resolved) return 'unresolved'
  const compat = j.compatibility ? ` [${j.compatibility}]` : ''
  return `${j.path} (java ${j.version}, major ${j.majorVersion}${compat})`
}

function fmtRuntime(rt: Record<string, string | undefined>): string {
  const keys = Object.keys(rt)
  if (!keys.length) return '(none)'
  return keys.map((k) => `${k}=${rt[k]}`).join(', ')
}

/**
 * Render the session snapshot into a self-contained Markdown block. The LLM
 * uses this as its anchor for "what does the user have right now" and we
 * inject it once at session start (not on every turn) so token usage stays
 * predictable.
 */
export function renderSessionContext(ctx: SessionContext): string {
  const ft = ctx.fileTree
  const tree = [
    fileLine('mods/', `${ft.modsTotal} total, ${ft.modsEnabled} enabled`),
    fileLine('resourcepacks/', `${ft.resourcePacksTotal} total, ${ft.resourcePacksEnabled} enabled`),
    fileLine('shaderpacks/', `${ft.shaderPacksTotal} total${ft.shaderSelected ? `, active: ${ft.shaderSelected}` : ''}`),
    fileLine('saves/', `${ft.savesTotal} world${ft.savesTotal === 1 ? '' : 's'}`),
    fileLine('logs/', `${ft.logsTotal} log file${ft.logsTotal === 1 ? '' : 's'}`),
    fileLine('crash-reports/', `${ft.crashReportsTotal} report${ft.crashReportsTotal === 1 ? '' : 's'}`),
    fileLine('launch-failures/', 'launcher-captured abnormal-exit dumps'),
    fileLine('instance.json', 'instance settings (read via vfs_read, change via edit_instance)'),
    fileLine('options.txt', 'minecraft game options (read via vfs_read)'),
  ].join('\n')

  return [
    '## Launcher session context (snapshot at session start)',
    '',
    `- **UI locale**: ${ctx.locale}`,
    `- **Selected user**: ${ctx.username} (${ctx.userType})`,
    `- **Instance**: ${ctx.instanceName}`,
    `- **Instance path**: \`${ctx.instancePath}\``,
    `- **Side**: ${ctx.side}`,
    `- **Runtime**: ${fmtRuntime(ctx.runtime)}`,
    `- **Resolved version**: ${fmtVersion(ctx.resolvedVersion)}`,
    `- **Resolved java**: ${fmtJava(ctx.resolvedJava)}`,
    '',
    'Virtual file tree (use `vfs_list <dir>` or `vfs_read <path>` to expand):',
    '```',
    `${ctx.instancePath || '<no instance>'}/`,
    tree,
    '```',
  ].join('\n')
}

// ── Mid-session change events ──────────────────────────────────────────

export interface ContextChange {
  resolvedVersion?: ResolvedVersionSnapshot
  resolvedJava?: ResolvedJavaSnapshot
  instancePath?: string
}

export function buildChangeEvent(prev: SessionContext, change: ContextChange): string | null {
  const lines: string[] = []
  if (change.instancePath && change.instancePath !== prev.instancePath) {
    lines.push(`- instance switched: ${prev.instancePath} → ${change.instancePath}`)
  }
  if (change.resolvedVersion) {
    const before = fmtVersion(prev.resolvedVersion)
    const after = fmtVersion(change.resolvedVersion)
    if (before !== after) lines.push(`- resolved version: ${before} → ${after}`)
  }
  if (change.resolvedJava) {
    const before = fmtJava(prev.resolvedJava)
    const after = fmtJava(change.resolvedJava)
    if (before !== after) lines.push(`- resolved java: ${before} → ${after}`)
  }
  if (!lines.length) return null
  return `[launcher event] context changed since the session started:\n${lines.join('\n')}`
}
