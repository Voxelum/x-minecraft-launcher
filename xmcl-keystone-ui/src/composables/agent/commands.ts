export type AgentLoader = 'forge' | 'neoforge' | 'fabric' | 'quilt'

export interface AgentCommandOperations {
  searchModrinth(input: { query: string; type?: string; gameVersion?: string; loader?: string; limit: number }, signal?: AbortSignal): Promise<unknown>
  getModrinthVersions(input: { project: string; gameVersion?: string; loader?: string; limit: number }, signal?: AbortSignal): Promise<unknown>
  searchCurseforge(input: { query: string; gameVersion?: string; limit: number }, signal?: AbortSignal): Promise<unknown>
  getCurseforgeFiles(input: { project: number; gameVersion?: string; limit: number }, signal?: AbortSignal): Promise<unknown>
  listLoaderVersions(input: { loader: AgentLoader; minecraft?: string; limit: number; refresh: boolean }, signal?: AbortSignal): Promise<unknown>
  installLoader(input: { loader: AgentLoader; version?: string }, signal?: AbortSignal): Promise<unknown>
}

export interface AgentRuntimeCommand {
  name: string
  usage: string
  description: string
  details: string[]
  execute(argv: string[], signal?: AbortSignal): Promise<unknown>
}

export function assertAgentCommandSyntax(argv: string[]) {
  const unsupported = argv.find(token =>
    token === '|' ||
    token === '||' ||
    token === '&&' ||
    token === ';' ||
    /(^\d*)[<>]/.test(token) ||
    token.includes('$(') ||
    token.includes('`'))
  if (unsupported) throw new Error(`Unsupported shell syntax: ${unsupported}. The bash tool accepts one XMCL command only.`)
}

interface ParsedArgs {
  positionals: string[]
  values: Map<string, string[]>
  booleans: Set<string>
}

function parseArgs(argv: string[], valueFlags: string[], booleanFlags: string[] = []): ParsedArgs {
  const parsed: ParsedArgs = { positionals: [], values: new Map(), booleans: new Set() }
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      parsed.positionals.push(token)
      continue
    }
    const name = token.slice(2)
    if (booleanFlags.includes(name)) {
      parsed.booleans.add(name)
      continue
    }
    if (!valueFlags.includes(name)) throw new Error(`Unknown option: ${token}`)
    const value = argv[++i]
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`)
    const values = parsed.values.get(name) ?? []
    values.push(value)
    parsed.values.set(name, values)
  }
  return parsed
}

const one = (parsed: ParsedArgs, name: string) => parsed.values.get(name)?.at(-1)
function limit(parsed: ParsedArgs, fallback = 10) {
  const raw = one(parsed, 'limit')
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > 25) throw new Error('--limit must be between 1 and 25')
  return value
}
function loader(value: string | undefined): AgentLoader {
  if (value === 'forge' || value === 'neoforge' || value === 'fabric' || value === 'quilt') return value
  throw new Error(`Unknown loader: ${value ?? ''}`)
}

export function createAgentRuntimeCommands(operations: AgentCommandOperations): AgentRuntimeCommand[] {
  return [
    {
      name: 'market',
      usage: 'market <modrinth|curseforge> <search|versions|files> ...',
      description: 'Search Modrinth or CurseForge and resolve exact install references.',
      details: [
        'market modrinth search <query> [--type mod] [--game-version <version>] [--loader <loader>] [--limit <1-25>]',
        'market modrinth versions <project> [--game-version <version>] [--loader <loader>] [--limit <1-25>]',
        'market curseforge search <query> [--game-version <version>] [--limit <1-25>]',
        'market curseforge files <projectId> [--game-version <version>] [--limit <1-25>]',
      ],
      async execute(argv, signal) {
        const [source, action, ...rest] = argv
        const parsed = parseArgs(rest, ['type', 'game-version', 'loader', 'limit'])
        if (source === 'modrinth' && action === 'search') {
          if (!parsed.positionals.length) throw new Error('market modrinth search requires a query')
          return operations.searchModrinth({
            query: parsed.positionals.join(' '),
            type: one(parsed, 'type'),
            gameVersion: one(parsed, 'game-version'),
            loader: one(parsed, 'loader'),
            limit: limit(parsed),
          }, signal)
        }
        if (source === 'modrinth' && action === 'versions') {
          if (parsed.positionals.length !== 1) throw new Error('market modrinth versions requires one project id or slug')
          return operations.getModrinthVersions({
            project: parsed.positionals[0],
            gameVersion: one(parsed, 'game-version'),
            loader: one(parsed, 'loader'),
            limit: limit(parsed),
          }, signal)
        }
        if (source === 'curseforge' && action === 'search') {
          if (!parsed.positionals.length) throw new Error('market curseforge search requires a query')
          return operations.searchCurseforge({
            query: parsed.positionals.join(' '),
            gameVersion: one(parsed, 'game-version'),
            limit: limit(parsed),
          }, signal)
        }
        if (source === 'curseforge' && action === 'files') {
          if (parsed.positionals.length !== 1) throw new Error('market curseforge files requires one numeric project id')
          const project = Number(parsed.positionals[0])
          if (!Number.isSafeInteger(project) || project <= 0) throw new Error('CurseForge project id must be a positive integer')
          return operations.getCurseforgeFiles({
            project,
            gameVersion: one(parsed, 'game-version'),
            limit: limit(parsed),
          }, signal)
        }
        throw new Error('Unknown market command. Run `help market`.')
      },
    },
    {
      name: 'version',
      usage: 'version list <forge|neoforge|fabric|quilt> [minecraftVersion] [--limit <1-25>] [--refresh]',
      description: 'List compatible mod-loader versions.',
      details: [],
      async execute(argv, signal) {
        const [action, provider, ...rest] = argv
        if (action !== 'list') throw new Error('Unknown version command. Run `help version`.')
        const parsed = parseArgs(rest, ['limit'], ['refresh'])
        if (parsed.positionals.length > 1) throw new Error('version list accepts at most one Minecraft version')
        const kind = loader(provider)
        if ((kind === 'forge' || kind === 'neoforge') && !parsed.positionals[0]) throw new Error(`${kind} requires a Minecraft version`)
        return operations.listLoaderVersions({
          loader: kind,
          minecraft: parsed.positionals[0],
          limit: limit(parsed),
          refresh: parsed.booleans.has('refresh'),
        }, signal)
      },
    },
    {
      name: 'loader',
      usage: 'loader install <forge|neoforge|fabric|quilt> [version]',
      description: 'Install a mod loader using the launcher renderer installation workflow.',
      details: [],
      async execute(argv, signal) {
        const [action, provider, version, ...extra] = argv
        if (action !== 'install' || extra.length) throw new Error('Unknown loader command. Run `help loader`.')
        return operations.installLoader({ loader: loader(provider), version }, signal)
      },
    },
  ]
}
