import type { Command, CommandCliFlag, CommandCliPositional } from './types'
import type { CommandRegistry } from './registry'

type AnyCommand = Command<any, any>

/**
 * Convert a kebab-case CLI flag name to camelCase, matching the input
 * field naming convention used by Zod schemas in this codebase.
 *
 * `--mod-count` ⇄ `modCount`
 */
export function kebabToCamel(s: string): string {
  return s.replace(/-([a-z0-9])/gi, (_, ch: string) => ch.toUpperCase())
}

/**
 * Inverse of {@link kebabToCamel}. Used when generating help text.
 */
export function camelToKebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Global flags shared by every CLI invocation. */
export interface CliGlobalFlags {
  /** Output structured JSON envelopes instead of human text. */
  json: boolean
  /** Suppress opening the launcher window. */
  noWindow: boolean
  /** Override the launcher root directory. */
  root?: string
  /** Bump log verbosity. */
  verbose: boolean
  /** Auto-accept confirmations. */
  yes: boolean
}

/** Result of {@link parseCli}. */
export type ParsedCli =
  | { kind: 'none'; globals: CliGlobalFlags }
  | { kind: 'help'; globals: CliGlobalFlags }
  | { kind: 'help-command'; commandId: string; globals: CliGlobalFlags }
  | { kind: 'version'; globals: CliGlobalFlags }
  | { kind: 'command'; commandId: string; input: Record<string, unknown>; globals: CliGlobalFlags }
  | { kind: 'error'; message: string; commandId?: string; globals: CliGlobalFlags }

const GLOBAL_BOOL_FLAGS = ['json', 'no-window', 'verbose', 'yes', 'help', 'version'] as const
const GLOBAL_VALUE_FLAGS = ['root'] as const

function makeGlobals(): CliGlobalFlags {
  return { json: false, noWindow: false, verbose: false, yes: false }
}

function getCommandName(cmd: AnyCommand): string {
  return cmd.cli?.name ?? cmd.id.replace(/\./g, ' ')
}

function buildCommandIndex(registry: CommandRegistry): Map<string, AnyCommand> {
  const map = new Map<string, AnyCommand>()
  for (const cmd of registry.list({ mode: 'cli' })) {
    map.set(getCommandName(cmd), cmd)
    for (const a of cmd.cli?.aliases ?? []) map.set(a, cmd)
  }
  return map
}

function normalizePositional<I>(p: CommandCliPositional<I>): { name: keyof I & string; parse?: (v: string) => unknown } {
  return typeof p === 'string' ? { name: p } : p
}

/**
 * Parse argv against the registry. Argv is the full process argv; the
 * parser scans left-to-right and ignores leading tokens until it
 * encounters a recognized command name. Global flags may appear anywhere.
 *
 * The parser performs no IO and never calls into the registry's handlers.
 * All shape errors are returned as `kind: 'error'` rather than thrown.
 */
export function parseCli(argv: ReadonlyArray<string>, registry: CommandRegistry): ParsedCli {
  const globals = makeGlobals()
  const commandIndex = buildCommandIndex(registry)

  let helpRequested = false
  let versionRequested = false
  let cmd: AnyCommand | undefined
  let cmdHelpRequested = false
  let cmdNameTokenIndex = -1

  // First pass: locate the command and harvest globals that appear before/after it.
  // We do not parse command-specific flags here.
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (!cmd) {
      if (commandIndex.has(tok)) {
        cmd = commandIndex.get(tok)!
        cmdNameTokenIndex = i
        continue
      }
    }
    // Global flags handling — recognise on either side of the command.
    if (tok === '--help' || tok === '-h') {
      if (cmd) cmdHelpRequested = true
      else helpRequested = true
      continue
    }
    if (tok === '--version' || tok === '-V') {
      versionRequested = true
      continue
    }
    if (tok === '--json') { globals.json = true; continue }
    if (tok === '--no-window' || tok === '--silent' || tok === '--minimized' || tok === '--hide') { globals.noWindow = true; continue }
    if (tok === '--verbose') { globals.verbose = true; continue }
    if (tok === '--yes' || tok === '-y') { globals.yes = true; continue }
    if (tok === '--root') {
      const val = argv[i + 1]
      if (val === undefined) {
        return { kind: 'error', message: '--root requires a value', globals }
      }
      globals.root = val
      i++
      continue
    }
    if (tok.startsWith('--root=')) {
      globals.root = tok.slice('--root='.length)
      continue
    }
  }

  if (versionRequested && !cmd) return { kind: 'version', globals }
  if (helpRequested && !cmd) return { kind: 'help', globals }

  if (!cmd) {
    return { kind: 'none', globals }
  }
  if (cmdHelpRequested) {
    return { kind: 'help-command', commandId: cmd.id, globals }
  }

  // Second pass: parse positionals and command-specific flags from the tail
  // after the command-name token. We re-skip global flags so they don't get
  // misclassified as positionals.
  const tail = argv.slice(cmdNameTokenIndex + 1)
  const positionals = (cmd.cli?.positionals ?? []).map(normalizePositional)
  const flagsByCanonical = new Map<string, CommandCliFlag>()
  const flagsByAlias = new Map<string, string>()
  for (const [name, decl] of Object.entries(cmd.cli?.flags ?? {})) {
    if (!decl) continue
    flagsByCanonical.set(name, decl)
    if (decl.alias) flagsByAlias.set(decl.alias, name)
  }

  const input: Record<string, unknown> = {}
  let positionalIdx = 0

  const setFlagValue = (name: string, raw: string, decl: CommandCliFlag | undefined) => {
    if (decl?.parse) input[name] = decl.parse(raw)
    else if (decl?.type === 'number') input[name] = Number(raw)
    else input[name] = raw
  }

  for (let i = 0; i < tail.length; i++) {
    const tok = tail[i]

    // Skip global flags (they were handled above). Long form may carry a value.
    if (tok === '--json' || tok === '--no-window' || tok === '--verbose' || tok === '--yes' || tok === '-y' || tok === '--help' || tok === '-h' || tok === '--version' || tok === '-V') continue
    if (tok === '--root') { i++; continue }
    if (tok.startsWith('--root=')) continue

    if (tok.startsWith('--')) {
      let rawName = tok.slice(2)
      let inlineValue: string | undefined
      const eq = rawName.indexOf('=')
      if (eq !== -1) {
        inlineValue = rawName.slice(eq + 1)
        rawName = rawName.slice(0, eq)
      }
      let negation = false
      if (rawName.startsWith('no-')) {
        negation = true
        rawName = rawName.slice(3)
      }
      const canonical = kebabToCamel(rawName)
      const decl = flagsByCanonical.get(canonical)
      const isBoolean = decl?.type === 'boolean'
      if (isBoolean) {
        if (inlineValue !== undefined) {
          input[canonical] = inlineValue === 'true'
        } else {
          input[canonical] = !negation
        }
        continue
      }
      // Non-boolean flag: needs a value (inline or next argv element).
      const value = inlineValue ?? tail[i + 1]
      if (value === undefined) {
        return { kind: 'error', message: `Flag --${rawName} requires a value`, commandId: cmd.id, globals }
      }
      setFlagValue(canonical, value, decl)
      if (inlineValue === undefined) i++
      continue
    }

    if (tok.startsWith('-') && tok.length > 1) {
      const aliasName = tok.slice(1)
      const canonical = flagsByAlias.get(aliasName)
      if (!canonical) {
        return { kind: 'error', message: `Unknown flag -${aliasName}`, commandId: cmd.id, globals }
      }
      const decl = flagsByCanonical.get(canonical)
      if (decl?.type === 'boolean') {
        input[canonical] = true
        continue
      }
      const value = tail[i + 1]
      if (value === undefined) {
        return { kind: 'error', message: `Flag -${aliasName} requires a value`, commandId: cmd.id, globals }
      }
      setFlagValue(canonical, value, decl)
      i++
      continue
    }

    // Positional.
    const slot = positionals[positionalIdx]
    if (!slot) {
      return { kind: 'error', message: `Unexpected argument '${tok}'`, commandId: cmd.id, globals }
    }
    input[slot.name] = slot.parse ? slot.parse(tok) : tok
    positionalIdx++
  }

  return { kind: 'command', commandId: cmd.id, input, globals }
}

/**
 * Render a top-level help string listing every CLI-bound command in the registry.
 */
export function formatHelp(registry: CommandRegistry, opts: { programName?: string } = {}): string {
  const program = opts.programName ?? 'xmcl'
  const lines: string[] = []
  lines.push(`Usage: ${program} [global-options] <command> [args]`)
  lines.push('')
  lines.push('Global options:')
  lines.push('  --json              Emit machine-readable JSON output')
  lines.push('  --no-window         Suppress launcher window')
  lines.push('  --root <dir>        Use a custom root directory')
  lines.push('  --verbose           Increase log verbosity')
  lines.push('  -y, --yes           Auto-accept confirmations')
  lines.push('  -h, --help          Show this help (or command-specific help when after a command)')
  lines.push('  -V, --version       Show launcher version')
  lines.push('')

  const byCategory = new Map<string, AnyCommand[]>()
  for (const cmd of registry.list({ mode: 'cli' })) {
    const list = byCategory.get(cmd.category) ?? []
    list.push(cmd)
    byCategory.set(cmd.category, list)
  }
  for (const [category, list] of byCategory) {
    lines.push(`Commands — ${category}:`)
    for (const cmd of list) {
      const name = getCommandName(cmd)
      lines.push(`  ${name.padEnd(28)} ${cmd.title}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Render help for a specific command, including its positionals and flags.
 */
export function formatCommandHelp(cmd: AnyCommand, opts: { programName?: string } = {}): string {
  const program = opts.programName ?? 'xmcl'
  const name = getCommandName(cmd)
  const lines: string[] = []
  const positionals = (cmd.cli?.positionals ?? []).map(normalizePositional)
  const positionalUsage = positionals.map((p) => `<${p.name}>`).join(' ')
  lines.push(`Usage: ${program} ${name}${positionalUsage ? ' ' + positionalUsage : ''} [options]`)
  lines.push('')
  lines.push(cmd.title)
  if (cmd.description) {
    lines.push('')
    lines.push(cmd.description)
  }

  const flags = Object.entries(cmd.cli?.flags ?? {}) as Array<[string, CommandCliFlag]>
  if (flags.length > 0) {
    lines.push('')
    lines.push('Options:')
    for (const [field, decl] of flags) {
      if (!decl) continue
      const aliasPart = decl.alias ? `-${decl.alias}, ` : '    '
      const valuePart = decl.type === 'boolean' ? '' : ' <value>'
      lines.push(`  ${aliasPart}--${camelToKebab(field)}${valuePart}`.padEnd(34) + (decl.description ?? ''))
    }
  }
  return lines.join('\n')
}
