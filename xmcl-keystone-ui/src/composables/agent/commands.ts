export type AgentLoader = 'forge' | 'neoforge' | 'fabric' | 'quilt'
export type AgentProjectType = 'mod' | 'resourcepack' | 'shader' | 'modpack' | 'datapack'
export type AgentMinecraftVersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha'

export type AgentModrinthQuery =
  | { kind: 'tags'; tag: 'loaders' | 'game-versions' | 'licenses' }
  | { kind: 'projects'; ids: string[] }
  | { kind: 'versions'; ids: string[] }
  | { kind: 'versions-by-hash'; hashes: string[]; algorithm: string; latest: boolean; loaders: string[]; gameVersions: string[]; multiple: boolean }
  | { kind: 'user'; id: string; related?: 'projects' | 'followed' | 'collections' }
  | { kind: 'authenticated-user' }
  | { kind: 'team'; project: string }

export type AgentCurseforgeQuery =
  | { kind: 'projects'; ids: number[] }
  | { kind: 'file'; project: number; file: number }
  | { kind: 'files'; ids: number[] }
  | { kind: 'description'; project: number }
  | { kind: 'changelog'; project: number; file: number }
  | { kind: 'fingerprints'; fingerprints: number[]; fuzzy: boolean }

export type AgentModrinthMutation =
  | { kind: 'follow' | 'unfollow'; project: string }
  | { kind: 'collection-create'; name: string; description: string; projects: string[] }
  | { kind: 'collection-add' | 'collection-remove'; collection: string; project: string }
  | { kind: 'collection-delete'; collection: string }

export interface AgentCommandOperations {
  listDocuments(signal?: AbortSignal): Promise<unknown>
  searchDocuments(input: { query: string; limit: number }, signal?: AbortSignal): Promise<unknown>
  readDocument(id: string, signal?: AbortSignal): Promise<unknown>
  getSystemInfo(signal?: AbortSignal): Promise<unknown>
  queryModrinth(input: AgentModrinthQuery, signal?: AbortSignal): Promise<unknown>
  mutateModrinth(input: AgentModrinthMutation, signal?: AbortSignal): Promise<unknown>
  getModrinthCategories(input: { type?: AgentProjectType }, signal?: AbortSignal): Promise<unknown>
  searchModrinth(input: { query: string; type: AgentProjectType; gameVersion?: string; loader?: string; all: boolean; categories: string[]; license?: string; environment?: 'client' | 'server'; index?: string; limit: number; page: number }, signal?: AbortSignal): Promise<unknown>
  getModrinthVersions(input: { project: string; gameVersion?: string; loader?: string; all: boolean; featured?: boolean; limit: number; page: number }, signal?: AbortSignal): Promise<unknown>
  queryCurseforge(input: AgentCurseforgeQuery, signal?: AbortSignal): Promise<unknown>
  getCurseforgeCategories(input: { classId?: number }, signal?: AbortSignal): Promise<unknown>
  searchCurseforge(input: { query: string; gameVersion?: string; classId?: number; category?: number; slug?: string; loaders: string[]; all: boolean; gameVersionType?: number; sort?: number; order?: 'asc' | 'desc'; limit: number; page: number }, signal?: AbortSignal): Promise<unknown>
  getCurseforgeFiles(input: { project: number; gameVersion?: string; loader?: string; all: boolean; gameVersionType?: number; limit: number; page: number }, signal?: AbortSignal): Promise<unknown>
  listLoaderMetadata(input: { loader: AgentLoader; minecraft?: string; limit: number; refresh: boolean }, signal?: AbortSignal): Promise<unknown>
  listMinecraftMetadata(input: { type?: AgentMinecraftVersionType; limit: number; refresh: boolean }, signal?: AbortSignal): Promise<unknown>
  listLocalVersions(input: { server: boolean; refresh: boolean }, signal?: AbortSignal): Promise<unknown>
  getLocalVersion(input: { id: string; server: boolean }, signal?: AbortSignal): Promise<unknown>
  refreshLocalVersions(input: { id?: string; server: boolean }, signal?: AbortSignal): Promise<unknown>
  deleteLocalVersion(input: { id: string }, signal?: AbortSignal): Promise<unknown>
  openLocalVersion(input: { id?: string }, signal?: AbortSignal): Promise<unknown>
  getInstanceRuntime(signal?: AbortSignal): Promise<unknown>
  setInstanceRuntime(input: { minecraft?: string; loader?: AgentLoader; loaderVersion?: string; noLoader: boolean }, signal?: AbortSignal): Promise<unknown>
  installInstance(signal?: AbortSignal): Promise<unknown>
  getInstanceManifest(signal?: AbortSignal): Promise<unknown>
  applyInstanceManifest(signal?: AbortSignal): Promise<unknown>
  discardInstanceManifest(signal?: AbortSignal): Promise<unknown>
  getServerStatus(signal?: AbortSignal): Promise<unknown>
  installServer(signal?: AbortSignal): Promise<unknown>
  deployServerMods(input: { compatible: boolean; paths: string[] }, signal?: AbortSignal): Promise<unknown>
  startServer(input: { nogui: boolean }, signal?: AbortSignal): Promise<unknown>
  stopServer(input: { force: boolean }, signal?: AbortSignal): Promise<unknown>
  getRemoteServerStatus(signal?: AbortSignal): Promise<unknown>
  testRemoteServerConnection(signal?: AbortSignal): Promise<unknown>
  installRemoteServerService(signal?: AbortSignal): Promise<unknown>
  uninstallRemoteServerService(signal?: AbortSignal): Promise<unknown>
  startRemoteServer(signal?: AbortSignal): Promise<unknown>
  stopRemoteServer(signal?: AbortSignal): Promise<unknown>
  restartRemoteServer(signal?: AbortSignal): Promise<unknown>
  listAccounts(signal?: AbortSignal): Promise<unknown>
  selectAccount(input: { ref: string }, signal?: AbortSignal): Promise<unknown>
  diagnoseJava(signal?: AbortSignal): Promise<unknown>
  listJava(input: { refresh: boolean }, signal?: AbortSignal): Promise<unknown>
  selectJava(input: { path?: string }, signal?: AbortSignal): Promise<unknown>
  installJava(input: { forceZulu: boolean }, signal?: AbortSignal): Promise<unknown>
  checkModDependencies(signal?: AbortSignal): Promise<unknown>
  installModDependencies(signal?: AbortSignal): Promise<unknown>
  scanUnusedMods(signal?: AbortSignal): Promise<unknown>
  checkModUpdates(input: { policy?: string; skipVersion?: boolean }, signal?: AbortSignal): Promise<unknown>
  stageModUpdates(signal?: AbortSignal): Promise<unknown>
  importWorld(input: { path: string; name?: string }, signal?: AbortSignal): Promise<unknown>
  exportWorld(input: { world: string; destination: string; zip: boolean }, signal?: AbortSignal): Promise<unknown>
  cloneWorld(input: { world: string; name?: string; destination?: string }, signal?: AbortSignal): Promise<unknown>
  linkWorldAsServer(input: { world: string }, signal?: AbortSignal): Promise<unknown>
  listInstances(signal?: AbortSignal): Promise<unknown>
  createInstance(input: { name: string; description?: string; runtime?: Record<string, string> }, signal?: AbortSignal): Promise<unknown>
  diagnoseInstance(signal?: AbortSignal): Promise<unknown>
  repairInstance(signal?: AbortSignal): Promise<unknown>
  duplicateInstance(input: { source?: string }, signal?: AbortSignal): Promise<unknown>
  deleteInstance(input: { target?: string; deleteData: boolean }, signal?: AbortSignal): Promise<unknown>
  importModpack(input: { path: string }, signal?: AbortSignal): Promise<unknown>
  listVfs(path: string, signal?: AbortSignal): Promise<unknown>
  readVfs(input: { path: string; tailLines?: number; offset?: number; limit?: number }, signal?: AbortSignal): Promise<unknown>
  removeVfs(paths: string[], signal?: AbortSignal): Promise<unknown>
  grepConfig(input: { pattern: string; path?: string; ignoreCase: boolean; offset?: number; limit?: number }, signal?: AbortSignal): Promise<unknown>
  moveResource(input: { source: string; destination: string }, signal?: AbortSignal): Promise<unknown>
  launchGame(signal?: AbortSignal): Promise<unknown>
  wait(input: { timeoutSeconds?: number; gameProcess?: number }, signal?: AbortSignal): Promise<unknown>
  stopGame(input: { force: boolean }, signal?: AbortSignal): Promise<unknown>
  navigateUi(input: { path: string }, signal?: AbortSignal): Promise<unknown>
}

export interface AgentRuntimeCommand {
  name: string
  aliases?: readonly string[]
  usage: string
  description: string
  details: string[]
  execute(argv: string[], signal?: AbortSignal): Promise<unknown>
}

export function createAgentRuntimeCommandIndex(commands: readonly AgentRuntimeCommand[]) {
  const index = new Map<string, AgentRuntimeCommand>()
  for (const command of commands) {
    for (const name of [command.name, ...(command.aliases ?? [])]) {
      const existing = index.get(name)
      if (existing) throw new Error(`Duplicate Agent runtime command name: ${name} (${existing.name}, ${command.name})`)
      index.set(name, command)
    }
  }
  return index
}

export function shouldShowAgentRuntimeCommandHelp(command: AgentRuntimeCommand, argv: string[]) {
  return argv.length === 0 && command.details.length > 0
}

export function formatAgentRuntimeCommandHelp(command: AgentRuntimeCommand) {
  return [`Usage: ${command.usage}`, '', command.description, '', ...command.details].join('\n')
}

class AgentRuntimeCommandUsageError extends Error {}

function commandUsageError(message: string) {
  return new AgentRuntimeCommandUsageError(message)
}

export async function executeAgentRuntimeCommand(command: AgentRuntimeCommand, argv: string[], signal?: AbortSignal) {
  if (shouldShowAgentRuntimeCommandHelp(command, argv)) return formatAgentRuntimeCommandHelp(command)
  try {
    return await command.execute(argv, signal)
  } catch (error) {
    if (error instanceof AgentRuntimeCommandUsageError) {
      throw new Error(`${error.message}\n\n${formatAgentRuntimeCommandHelp(command)}`)
    }
    throw error
  }
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
  if (unsupported) throw new Error(`Unsupported shell syntax: ${unsupported}. The vfs_shell tool accepts one XMCL command only.`)
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
      if (token.startsWith('-') && token !== '-') throw new Error(`Unknown option: ${token}`)
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

function assertFlags(parsed: ParsedArgs, valueFlags: string[], booleanFlags: string[], command: string) {
  const unknownValue = [...parsed.values.keys()].find(value => !valueFlags.includes(value))
  const unknownBoolean = [...parsed.booleans].find(value => !booleanFlags.includes(value))
  if (unknownValue || unknownBoolean) throw new Error(`${command} does not accept --${unknownValue ?? unknownBoolean}`)
}

const one = (parsed: ParsedArgs, name: string) => parsed.values.get(name)?.at(-1)
function limit(parsed: ParsedArgs, fallback = 10) {
  const raw = one(parsed, 'limit')
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > 25) throw new Error('--limit must be between 1 and 25')
  return value
}
function page(parsed: ParsedArgs) {
  const raw = one(parsed, 'page')
  if (!raw) return 1
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('--page must be a positive integer')
  return value
}
function positiveInteger(raw: string, label: string) {
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}
function positiveNumber(raw: string, label: string) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number`)
  return value
}
function nonNegativeInteger(raw: string, label: string) {
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`)
  return value
}
function curseforgeLoader(value: string | undefined) {
  if (value === undefined) return undefined
  const loaders: Record<string, number> = { any: 0, forge: 1, cauldron: 2, liteloader: 3, fabric: 4, quilt: 5, neoforge: 6 }
  const result = loaders[value.toLowerCase()]
  if (result === undefined) throw new Error(`Unknown CurseForge loader: ${value}`)
  return result
}
function loader(value: string | undefined): AgentLoader {
  if (value === 'forge' || value === 'neoforge' || value === 'fabric' || value === 'quilt') return value
  throw new Error(`Unknown loader: ${value ?? ''}`)
}

function optionalLoader(value: string | undefined): AgentLoader | undefined {
  if (value === 'forge' || value === 'neoforge' || value === 'fabric' || value === 'quilt') return value
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function withModrinthSearchInstallRef<T extends { project_id: string; latest_version?: string }>(project: T): T & { installRef?: string } {
  return typeof project.latest_version === 'string' && project.latest_version
    ? { ...project, installRef: `modrinth:${project.project_id}@${project.latest_version}` }
    : { ...project }
}

function compactProjectResult(value: unknown, compact: (project: Record<string, unknown>) => Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map(entry => isRecord(entry) ? compact(entry) : entry)
  if (!isRecord(value)) return value
  if (Array.isArray(value.data)) return { ...value, data: value.data.map(entry => isRecord(entry) ? compact(entry) : entry) }
  if (isRecord(value.data)) return { ...value, data: compact(value.data) }
  return compact(value)
}

function truncateProjectDescription(value: unknown) {
  if (typeof value !== 'string' || value.length <= 500) return value
  return `${value.slice(0, 497).trimEnd()}...`
}

function pickRecordFields(value: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(fields.filter(key => key in value).map(key => [key, value[key]]))
}

function compactModrinthLoaderTags(value: unknown) {
  return compactProjectResult(value, loader => Object.fromEntries(Object.entries(loader).filter(([key]) => key !== 'icon')))
}

function compactCurseforgeCategories(value: unknown): unknown {
  const compact = (category: unknown) => isRecord(category) ? pickRecordFields(category, ['id', 'name', 'slug']) : category
  if (Array.isArray(value)) return value.map(compact)
  if (!isRecord(value)) return value
  if (Array.isArray(value.categories)) return { ...value, categories: value.categories.map(compact) }
  if (Array.isArray(value.data)) return { ...value, data: value.data.map(compact) }
  return compact(value)
}

function compactCurseforgeFileResult(value: unknown) {
  return compactProjectResult(value, file => Object.fromEntries(Object.entries(file).filter(([key]) => key !== 'modules')))
}

export function compactModrinthProjectResult(value: unknown) {
  const noise = new Set(['body', 'body_url', 'gallery', 'featured_gallery', 'color', 'monetization_status', 'thread_id', 'donation_urls', 'followers'])
  return compactProjectResult(value, (project) => {
    const result = Object.fromEntries(Object.entries(project).filter(([key]) => !noise.has(key)))
    if ('description' in result) result.description = truncateProjectDescription(result.description)
    if ('summary' in result) result.summary = truncateProjectDescription(result.summary)
    return result
  })
}

export function compactCurseforgeProjectResult(value: unknown) {
  return compactProjectResult(value, (project) => {
    const noise = new Set(['latestFilesIndexes', 'sortableGameVersions'])
    const result = Object.fromEntries(Object.entries(project).filter(([key]) => !noise.has(key)))
    if (Array.isArray(project.screenshots)) {
      result.screenshots = project.screenshots.flatMap((entry) => {
        if (!isRecord(entry) || typeof entry.url !== 'string') return []
        return [{ url: entry.url }]
      })
    }
    if (Array.isArray(project.latestFiles)) {
      result.latestFiles = project.latestFiles.map((entry) => {
        if (!isRecord(entry)) return entry
        const file = pickRecordFields(entry, ['displayName', 'fileName', 'gameVersions', 'releaseType', 'downloadUrl', 'dependencies', 'installRef'])
        if (!file.installRef && Number.isSafeInteger(entry.modId) && Number.isSafeInteger(entry.id)) {
          file.installRef = `curseforge:${entry.modId}/${entry.id}`
        }
        return file
      })
    }
    return result
  })
}

function compactCurseforgeSearchResult(value: unknown) {
  if (Array.isArray(value)) return compactCurseforgeProjectResult(value)
  if (!isRecord(value)) return value
  if (Array.isArray(value.projects)) {
    return { ...value, projects: value.projects.map(compactCurseforgeProjectResult) }
  }
  return compactCurseforgeProjectResult(value)
}

export function createAgentRuntimeCommands(operations: AgentCommandOperations): AgentRuntimeCommand[] {
  const modrinthCommand: AgentRuntimeCommand = {
    name: 'modrinth',
    usage: 'modrinth <resource> ...',
    description: 'Use the official Modrinth API and resolve exact install references.',
    details: [
      'modrinth tags <loaders|game-versions|licenses>',
      'modrinth categories [--type <project-type>]',
      'modrinth search <query> --type <mod|resourcepack|shader|modpack|datapack> [--game-version <version>] [--loader <loader>] [--all] [--category <slug>...] [--license <id>] [--environment <client|server>] [--index <relevance|downloads|follows|newest|updated>] [--page <number>] [--limit <1-25>]',
      'modrinth project <id-or-slug> [id-or-slug...] [--compact]',
      'modrinth versions <project> [--game-version <version>] [--loader <loader>] [--all] [--featured|--unfeatured] [--page <number>] [--limit <1-25>]',
      'modrinth version <version-id> [version-id...]',
      'modrinth hash <hash> [hash...] [--algorithm <sha1|sha512>] [--latest] [--loader <loader>...] [--game-version <version>...] [--multiple]',
      'modrinth user <id> [--projects|--followed|--collections]',
      'modrinth me',
      'modrinth team <project>',
      'modrinth <follow|unfollow> <project>',
      'modrinth collection <create|add|remove|delete> ...',
    ],
    async execute(argv, signal) {
      const [action, ...rest] = argv
      const parsed = parseArgs(rest, ['type', 'game-version', 'loader', 'category', 'page', 'limit', 'algorithm', 'license', 'environment', 'index', 'description', 'project'], ['latest', 'multiple', 'projects', 'followed', 'collections', 'fuzzy', 'featured', 'unfeatured', 'compact', 'all'])
      if (action === 'tags') {
          if (parsed.positionals.length !== 1 || parsed.values.size || parsed.booleans.size) throw new Error('modrinth tags requires loaders, game-versions, or licenses')
          const tag = parsed.positionals[0]
          if (tag !== 'loaders' && tag !== 'game-versions' && tag !== 'licenses') throw new Error(`Unknown Modrinth tag: ${tag}`)
          const result = await operations.queryModrinth({ kind: 'tags', tag }, signal)
          return tag === 'loaders' ? compactModrinthLoaderTags(result) : result
        }
        if (action === 'categories') {
          assertFlags(parsed, ['type'], [], 'modrinth categories')
          if (parsed.positionals.length) throw new Error('modrinth categories accepts only --type')
          const type = one(parsed, 'type')
          if (type && !['mod', 'resourcepack', 'shader', 'modpack', 'datapack'].includes(type)) throw new Error(`Unsupported Modrinth project type: ${type}`)
          return operations.getModrinthCategories({ type: type as AgentProjectType | undefined }, signal)
        }
        if (action === 'search') {
          assertFlags(parsed, ['type', 'game-version', 'loader', 'category', 'license', 'environment', 'index', 'page', 'limit'], ['all'], 'modrinth search')
          if (parsed.booleans.has('all') && (one(parsed, 'game-version') || one(parsed, 'loader'))) throw new Error('--all cannot be combined with --game-version or --loader')
          const type = one(parsed, 'type')
          if (!type) throw commandUsageError('modrinth search requires --type <mod|resourcepack|shader|modpack|datapack>.')
          if (!['mod', 'resourcepack', 'shader', 'modpack', 'datapack'].includes(type)) {
            throw new Error(`Unsupported Modrinth project type: ${type}`)
          }
          const environment = one(parsed, 'environment')
          if (environment && environment !== 'client' && environment !== 'server') throw new Error('--environment must be client or server')
          const index = one(parsed, 'index')
          if (index && !['relevance', 'downloads', 'follows', 'newest', 'updated'].includes(index)) throw new Error('Unknown Modrinth search index')
          return operations.searchModrinth({
            query: parsed.positionals.join(' '),
            type: type as AgentProjectType,
            gameVersion: one(parsed, 'game-version'),
            loader: one(parsed, 'loader'),
            all: parsed.booleans.has('all'),
            categories: parsed.values.get('category') ?? [],
            license: one(parsed, 'license'),
            environment: environment as 'client' | 'server' | undefined,
            index,
            limit: limit(parsed),
            page: page(parsed),
          }, signal)
        }
        if (action === 'project') {
          assertFlags(parsed, [], ['compact'], 'modrinth project')
          if (!parsed.positionals.length) throw new Error('modrinth project requires one or more ids or slugs')
          const result = await operations.queryModrinth({ kind: 'projects', ids: parsed.positionals }, signal)
          return parsed.booleans.has('compact') ? compactModrinthProjectResult(result) : result
        }
        if (action === 'versions') {
          assertFlags(parsed, ['game-version', 'loader', 'page', 'limit'], ['featured', 'unfeatured', 'all'], 'modrinth versions')
          if (parsed.positionals.length !== 1) throw new Error('modrinth versions requires one project id or slug')
          if (parsed.booleans.has('featured') && parsed.booleans.has('unfeatured')) throw new Error('Use only one of --featured or --unfeatured')
          if (parsed.booleans.has('all') && (one(parsed, 'game-version') || one(parsed, 'loader'))) throw new Error('--all cannot be combined with --game-version or --loader')
          return operations.getModrinthVersions({
            project: parsed.positionals[0],
            gameVersion: one(parsed, 'game-version'),
            loader: one(parsed, 'loader'),
            all: parsed.booleans.has('all'),
            featured: parsed.booleans.has('featured') ? true : parsed.booleans.has('unfeatured') ? false : undefined,
            limit: limit(parsed),
            page: page(parsed),
          }, signal)
        }
        if (action === 'version') {
          if (!parsed.positionals.length || parsed.values.size || parsed.booleans.size) throw new Error('modrinth version requires one or more version ids')
          return operations.queryModrinth({ kind: 'versions', ids: parsed.positionals }, signal)
        }
        if (action === 'hash') {
          assertFlags(parsed, ['algorithm', 'loader', 'game-version'], ['latest', 'multiple'], 'modrinth hash')
          if (!parsed.positionals.length) throw new Error('modrinth hash requires one or more hashes')
          const algorithm = one(parsed, 'algorithm') ?? 'sha1'
          if (algorithm !== 'sha1' && algorithm !== 'sha512') throw new Error('--algorithm must be sha1 or sha512')
          const multiple = parsed.booleans.has('multiple')
          if (multiple && parsed.positionals.length !== 1) throw new Error('--multiple requires exactly one hash')
          if (multiple && parsed.booleans.has('latest')) throw new Error('--multiple cannot be combined with --latest')
          return operations.queryModrinth({
            kind: 'versions-by-hash',
            hashes: parsed.positionals,
            algorithm,
            latest: parsed.booleans.has('latest'),
            loaders: parsed.values.get('loader') ?? [],
            gameVersions: parsed.values.get('game-version') ?? [],
            multiple,
          }, signal)
        }
        if (action === 'user') {
          assertFlags(parsed, [], ['projects', 'followed', 'collections'], 'modrinth user')
          if (parsed.positionals.length !== 1 || parsed.values.size) throw new Error('modrinth user requires one user id')
          const related = (['projects', 'followed', 'collections'] as const).filter(value => parsed.booleans.has(value))
          if (related.length > 1) throw new Error('Use only one of --projects, --followed, or --collections')
          return operations.queryModrinth({ kind: 'user', id: parsed.positionals[0], related: related[0] }, signal)
        }
        if (action === 'me') {
          if (rest.length) throw new Error('modrinth me does not accept arguments')
          return operations.queryModrinth({ kind: 'authenticated-user' }, signal)
        }
        if (action === 'team') {
          if (parsed.positionals.length !== 1 || parsed.values.size || parsed.booleans.size) throw new Error('modrinth team requires one project')
          return operations.queryModrinth({ kind: 'team', project: parsed.positionals[0] }, signal)
        }
        if (action === 'follow' || action === 'unfollow') {
          if (parsed.positionals.length !== 1 || parsed.values.size || parsed.booleans.size) throw new Error(`modrinth ${action} requires one project`)
          return operations.mutateModrinth({ kind: action, project: parsed.positionals[0] }, signal)
        }
        if (action === 'collection') {
          const [collectionAction, ...positionals] = parsed.positionals
          if (collectionAction === 'create') {
            assertFlags(parsed, ['description', 'project'], [], 'modrinth collection create')
            if (positionals.length !== 1) throw new Error('modrinth collection create requires one name')
            return operations.mutateModrinth({ kind: 'collection-create', name: positionals[0], description: one(parsed, 'description') ?? '', projects: parsed.values.get('project') ?? [] }, signal)
          }
          if (collectionAction === 'add' || collectionAction === 'remove') {
            if (positionals.length !== 2 || parsed.values.size || parsed.booleans.size) throw new Error(`modrinth collection ${collectionAction} requires a collection id and project id`)
            return operations.mutateModrinth({ kind: collectionAction === 'add' ? 'collection-add' : 'collection-remove', collection: positionals[0], project: positionals[1] }, signal)
          }
          if (collectionAction === 'delete') {
            if (positionals.length !== 1 || parsed.values.size || parsed.booleans.size) throw new Error('modrinth collection delete requires one collection id')
            return operations.mutateModrinth({ kind: 'collection-delete', collection: positionals[0] }, signal)
          }
          throw commandUsageError('Unknown Modrinth collection command.')
        }
      throw commandUsageError('Unknown modrinth command.')
    },
  }
  const curseforgeCommand: AgentRuntimeCommand = {
    name: 'curseforge',
    usage: 'curseforge <resource> ...',
    description: 'Use the official CurseForge API and resolve exact install references.',
    details: [
      'curseforge categories [--class <id>]',
      'curseforge search [query] [--class <id>] [--category <id>] [--slug <slug>] [--game-version <version>] [--loader <loader>...] [--all] [--game-version-type <id>] [--sort <1-8>] [--order <asc|desc>] [--page <number>] [--limit <1-25>]',
      'curseforge project <project-id> [project-id...] [--compact]',
      'curseforge files <projectId> [--game-version <version>] [--loader <loader>] [--all] [--game-version-type <id>] [--page <number>] [--limit <1-25>]',
      'curseforge file <project-id> <file-id>',
      'curseforge files-by-id <file-id> [file-id...]',
      'curseforge description <project-id>',
      'curseforge changelog <project-id> <file-id>',
      'curseforge fingerprints <fingerprint> [fingerprint...] [--fuzzy]',
    ],
    async execute(argv, signal) {
      const [action, ...rest] = argv
      const parsed = parseArgs(rest, ['game-version', 'loader', 'category', 'page', 'limit', 'class', 'slug', 'game-version-type', 'sort', 'order'], ['latest', 'fuzzy', 'compact', 'all'])
        if (action === 'search') {
          assertFlags(parsed, ['game-version', 'loader', 'category', 'page', 'limit', 'class', 'slug', 'game-version-type', 'sort', 'order'], ['all'], 'curseforge search')
          if (parsed.booleans.has('all') && (one(parsed, 'game-version') || parsed.values.has('loader'))) throw new Error('--all cannot be combined with --game-version or --loader')
          const rawCategory = one(parsed, 'category')
          const category = rawCategory === undefined ? undefined : Number(rawCategory)
          if (category !== undefined && (!Number.isSafeInteger(category) || category <= 0)) throw new Error('CurseForge category id must be a positive integer')
          const rawClass = one(parsed, 'class')
          const rawGameVersionType = one(parsed, 'game-version-type')
          const rawSort = one(parsed, 'sort')
          const order = one(parsed, 'order')
          if (order && order !== 'asc' && order !== 'desc') throw new Error('--order must be asc or desc')
          if (rawSort && positiveInteger(rawSort, 'CurseForge sort field') > 8) throw new Error('CurseForge sort field must be between 1 and 8')
          const result = await operations.searchCurseforge({
            query: parsed.positionals.join(' '),
            gameVersion: one(parsed, 'game-version'),
            classId: rawClass ? positiveInteger(rawClass, 'CurseForge class id') : undefined,
            category,
            slug: one(parsed, 'slug'),
            loaders: parsed.values.get('loader') ?? [],
            all: parsed.booleans.has('all'),
            gameVersionType: rawGameVersionType ? positiveInteger(rawGameVersionType, 'CurseForge game version type id') : undefined,
            sort: rawSort ? positiveInteger(rawSort, 'CurseForge sort field') : undefined,
            order: order as 'asc' | 'desc' | undefined,
            limit: limit(parsed),
            page: page(parsed),
          }, signal)
          return compactCurseforgeSearchResult(result)
        }
        if (action === 'categories') {
          assertFlags(parsed, ['class'], [], 'curseforge categories')
          if (parsed.positionals.length) throw new Error('curseforge categories accepts only --class')
          const rawClass = one(parsed, 'class')
          const result = await operations.getCurseforgeCategories({ classId: rawClass ? positiveInteger(rawClass, 'CurseForge class id') : undefined }, signal)
          return compactCurseforgeCategories(result)
        }
        if (action === 'project') {
          assertFlags(parsed, [], ['compact'], 'curseforge project')
          if (!parsed.positionals.length) throw new Error('curseforge project requires one or more project ids')
          const result = await operations.queryCurseforge({ kind: 'projects', ids: parsed.positionals.map(value => positiveInteger(value, 'CurseForge project id')) }, signal)
          return parsed.booleans.has('compact') ? compactCurseforgeProjectResult(result) : result
        }
        if (action === 'files') {
          assertFlags(parsed, ['game-version', 'loader', 'game-version-type', 'page', 'limit'], ['all'], 'curseforge files')
          if (parsed.positionals.length !== 1) throw new Error('curseforge files requires one numeric project id')
          if (parsed.booleans.has('all') && (one(parsed, 'game-version') || one(parsed, 'loader'))) throw new Error('--all cannot be combined with --game-version or --loader')
          const project = Number(parsed.positionals[0])
          if (!Number.isSafeInteger(project) || project <= 0) throw new Error('CurseForge project id must be a positive integer')
          return operations.getCurseforgeFiles({
            project,
            gameVersion: one(parsed, 'game-version'),
            loader: one(parsed, 'loader'),
            all: parsed.booleans.has('all'),
            gameVersionType: one(parsed, 'game-version-type') ? positiveInteger(one(parsed, 'game-version-type')!, 'CurseForge game version type id') : undefined,
            limit: limit(parsed),
            page: page(parsed),
          }, signal)
        }
        if (action === 'file') {
          if (parsed.positionals.length !== 2 || parsed.values.size || parsed.booleans.size) throw new Error('curseforge file requires a project id and file id')
          const result = await operations.queryCurseforge({
            kind: 'file',
            project: positiveInteger(parsed.positionals[0], 'CurseForge project id'),
            file: positiveInteger(parsed.positionals[1], 'CurseForge file id'),
          }, signal)
          return compactCurseforgeFileResult(result)
        }
        if (action === 'files-by-id') {
          if (!parsed.positionals.length || parsed.values.size || parsed.booleans.size) throw new Error('curseforge files-by-id requires one or more file ids')
          const result = await operations.queryCurseforge({ kind: 'files', ids: parsed.positionals.map(value => positiveInteger(value, 'CurseForge file id')) }, signal)
          return compactCurseforgeFileResult(result)
        }
        if (action === 'description') {
          if (parsed.positionals.length !== 1 || parsed.values.size || parsed.booleans.size) throw new Error('curseforge description requires one project id')
          return operations.queryCurseforge({ kind: 'description', project: positiveInteger(parsed.positionals[0], 'CurseForge project id') }, signal)
        }
        if (action === 'changelog') {
          if (parsed.positionals.length !== 2 || parsed.values.size || parsed.booleans.size) throw new Error('curseforge changelog requires a project id and file id')
          return operations.queryCurseforge({
            kind: 'changelog',
            project: positiveInteger(parsed.positionals[0], 'CurseForge project id'),
            file: positiveInteger(parsed.positionals[1], 'CurseForge file id'),
          }, signal)
        }
        if (action === 'fingerprints') {
          assertFlags(parsed, [], ['fuzzy'], 'curseforge fingerprints')
          if (!parsed.positionals.length) throw new Error('curseforge fingerprints requires one or more numeric fingerprints')
          return operations.queryCurseforge({
            kind: 'fingerprints',
            fingerprints: parsed.positionals.map(value => positiveInteger(value, 'CurseForge fingerprint')),
            fuzzy: parsed.booleans.has('fuzzy'),
          }, signal)
        }
      throw commandUsageError('Unknown curseforge command.')
    },
  }
  return [
    {
      name: 'document',
      aliases: ['docs'],
      usage: 'document <list|search|read> ...',
      description: 'Search and read built-in XMCL workflow documentation.',
      details: [
        'document list',
        'document search <query> [--limit <1-25>]',
        'document read <document-id>',
      ],
      async execute(argv, signal) {
        const [action, ...rest] = argv
        if (action === 'list') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length) throw commandUsageError('document list does not accept arguments.')
          return { documents: await operations.listDocuments(signal) }
        }
        if (action === 'search') {
          const parsed = parseArgs(rest, ['limit'])
          if (!parsed.positionals.length) throw commandUsageError('document search requires a query.')
          const query = parsed.positionals.join(' ')
          return { query, documents: await operations.searchDocuments({ query, limit: limit(parsed, 5) }, signal) }
        }
        if (action === 'read') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length !== 1) throw commandUsageError('document read requires one document id.')
          return operations.readDocument(parsed.positionals[0], signal)
        }
        throw commandUsageError('Unknown document command.')
      },
    },
    {
      name: 'system',
      usage: 'system info',
      description: 'Inspect this computer CPU, memory, instance disk, GPU, and operating system capabilities.',
      details: ['system info'],
      async execute(argv, signal) {
        if (argv.length !== 1 || argv[0] !== 'info') throw commandUsageError('Unknown system command.')
        return operations.getSystemInfo(signal)
      },
    },
    modrinthCommand,
    curseforgeCommand,
    {
      name: 'version-metadata',
      usage: 'version-metadata <minecraft|loader> ...',
      description: 'Discover available Minecraft and mod-loader versions without changing the selected instance.',
      details: [
        'version-metadata minecraft [--type <release|snapshot|old_beta|old_alpha>] [--limit <1-25>] [--refresh]',
        'version-metadata loader <forge|neoforge|fabric|quilt> [minecraftVersion] [--game-version <version>] [--limit <1-25>] [--refresh]',
        'The Minecraft version for loader metadata defaults to the selected instance.',
      ],
      async execute(argv, signal) {
        const [action, ...rest] = argv
        if (action === 'minecraft') {
          const parsed = parseArgs(rest, ['type', 'limit'], ['refresh'])
          if (parsed.positionals.length) throw new Error('version-metadata minecraft accepts only named options')
          const type = one(parsed, 'type')
          const supportedTypes: AgentMinecraftVersionType[] = ['release', 'snapshot', 'old_beta', 'old_alpha']
          if (type && !supportedTypes.includes(type as AgentMinecraftVersionType)) throw new Error(`Unknown Minecraft version type: ${type}`)
          return operations.listMinecraftMetadata({
            type: type as AgentMinecraftVersionType | undefined,
            limit: limit(parsed, 25),
            refresh: parsed.booleans.has('refresh'),
          }, signal)
        }
        if (action === 'loader') {
          const parsed = parseArgs(rest, ['game-version', 'limit'], ['refresh'])
          if (parsed.positionals.length > 2) throw new Error('version-metadata loader accepts at most a loader and Minecraft version')
          const [first, second] = parsed.positionals
          const kind = optionalLoader(first)
          if (!kind) throw new Error(first ? `Unknown loader: ${first}` : 'version-metadata loader requires a loader')
          const positionalMinecraft = second
          const flaggedMinecraft = one(parsed, 'game-version')
          if (positionalMinecraft && flaggedMinecraft) throw new Error('Specify the Minecraft version once')
          return operations.listLoaderMetadata({
            loader: kind,
            minecraft: flaggedMinecraft ?? positionalMinecraft,
            limit: limit(parsed),
            refresh: parsed.booleans.has('refresh'),
          }, signal)
        }
        throw commandUsageError('Unknown version-metadata command.')
      },
    },
    {
      name: 'version',
      usage: 'version <list|info|refresh|delete|open> ...',
      description: 'Inspect and manage locally installed Minecraft client and server versions.',
      details: [
        'version list [--server] [--refresh]',
        'version info <id> [--server]',
        'version refresh [id] [--server]',
        'version delete <id>',
        'version open [id]',
      ],
      async execute(argv, signal) {
        const [action, ...rest] = argv
        if (action === 'list') {
          const parsed = parseArgs(rest, [], ['server', 'refresh'])
          if (parsed.positionals.length) throw new Error('version list accepts only --server and --refresh')
          return operations.listLocalVersions({
            server: parsed.booleans.has('server'),
            refresh: parsed.booleans.has('refresh'),
          }, signal)
        }
        if (action === 'info') {
          const parsed = parseArgs(rest, [], ['server'])
          if (parsed.positionals.length !== 1) throw new Error('version info requires one local version id')
          return operations.getLocalVersion({ id: parsed.positionals[0], server: parsed.booleans.has('server') }, signal)
        }
        if (action === 'refresh') {
          const parsed = parseArgs(rest, [], ['server'])
          if (parsed.positionals.length > 1) throw new Error('version refresh accepts at most one local version id')
          return operations.refreshLocalVersions({ id: parsed.positionals[0], server: parsed.booleans.has('server') }, signal)
        }
        if (action === 'delete') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length !== 1) throw new Error('version delete requires one local client version id')
          return operations.deleteLocalVersion({ id: parsed.positionals[0] }, signal)
        }
        if (action === 'open') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length > 1) throw new Error('version open accepts at most one local client version id')
          return operations.openLocalVersion({ id: parsed.positionals[0] }, signal)
        }
        throw commandUsageError('Unknown version command.')
      },
    },
    {
      name: 'user',
      usage: 'user <list|select> [account]',
      description: 'List logged-in accounts or select one without exposing credentials.',
      details: ['user list', 'user select <id-or-name>'],
      async execute(argv, signal) {
        const [action, ref, ...extra] = argv
        if (action === 'list' && ref === undefined) return operations.listAccounts(signal)
        if (action === 'select' && ref && !extra.length) return operations.selectAccount({ ref }, signal)
        throw commandUsageError('Unknown user command.')
      },
    },
    {
      name: 'java',
      usage: 'java <diagnose|list|select|install> [options]',
      description: 'Inspect, select, or install Java for the selected instance.',
      details: [
        'java diagnose',
        'java list [--refresh]',
        'java select <local-java-path|auto>',
        'java install [--zulu]',
      ],
      async execute(argv, signal) {
        const [action, ...rest] = argv
        if (action === 'diagnose' && !rest.length) return operations.diagnoseJava(signal)
        if (action === 'list') {
          const parsed = parseArgs(rest, [], ['refresh'])
          if (parsed.positionals.length) throw new Error('java list accepts only --refresh')
          return operations.listJava({ refresh: parsed.booleans.has('refresh') }, signal)
        }
        if (action === 'select') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length !== 1) throw new Error('java select requires one local path or auto')
          return operations.selectJava({ path: parsed.positionals[0] === 'auto' ? undefined : parsed.positionals[0] }, signal)
        }
        if (action === 'install') {
          const parsed = parseArgs(rest, [], ['zulu'])
          if (parsed.positionals.length) throw new Error('java install accepts only --zulu')
          return operations.installJava({ forceZulu: parsed.booleans.has('zulu') }, signal)
        }
        throw commandUsageError('Unknown java command.')
      },
    },
    {
      name: 'mod',
      usage: 'mod <dependencies check|dependencies install|unused scan|update check|update stage> [options]',
      description: 'Diagnose dependencies, unused libraries, and compatible updates for installed mods.',
      details: [
        'mod dependencies check',
        'mod dependencies install',
        'mod unused scan',
        'mod update check [--policy <modrinth|curseforge|modrinthOnly|curseforgeOnly>] [--skip-version]',
        'mod update stage',
      ],
      async execute(argv, signal) {
        const [group, action, ...rest] = argv
        if (group === 'dependencies' && action === 'check' && !rest.length) return operations.checkModDependencies(signal)
        if (group === 'dependencies' && action === 'install' && !rest.length) return operations.installModDependencies(signal)
        if (group === 'unused' && action === 'scan' && !rest.length) return operations.scanUnusedMods(signal)
        if (group === 'update' && action === 'stage' && !rest.length) return operations.stageModUpdates(signal)
        if (group === 'update' && action === 'check') {
          const parsed = parseArgs(rest, ['policy'], ['skip-version'])
          if (parsed.positionals.length) throw new Error('mod update check accepts only options')
          const policy = one(parsed, 'policy')
          if (policy && !['modrinth', 'curseforge', 'modrinthOnly', 'curseforgeOnly'].includes(policy)) {
            throw new Error(`Unknown mod update policy: ${policy}`)
          }
          return operations.checkModUpdates({
            policy,
            skipVersion: parsed.booleans.has('skip-version') ? true : undefined,
          }, signal)
        }
        throw commandUsageError('Unknown mod command.')
      },
    },
    {
      name: 'world',
      usage: 'world <import|export|clone|link-server> ...',
      description: 'Import, export, clone, or link worlds for the selected instance.',
      details: [
        'world import <path> [--name <save-name>]',
        'world export <world> <destination> [--zip|--directory]',
        'world clone <world> [--name <save-name>] [--to-instance <instance-path>]',
        'world link-server <world>',
      ],
      async execute(argv, signal) {
        const [action, ...rest] = argv
        if (action === 'import') {
          const parsed = parseArgs(rest, ['name'])
          if (parsed.positionals.length !== 1) throw new Error('world import requires one path')
          return operations.importWorld({ path: parsed.positionals[0], name: one(parsed, 'name') }, signal)
        }
        if (action === 'export') {
          const parsed = parseArgs(rest, [], ['zip', 'directory'])
          if (parsed.positionals.length !== 2) throw new Error('world export requires a world and destination')
          if (parsed.booleans.has('zip') && parsed.booleans.has('directory')) throw new Error('Use only one of --zip or --directory')
          return operations.exportWorld({
            world: parsed.positionals[0],
            destination: parsed.positionals[1],
            zip: !parsed.booleans.has('directory'),
          }, signal)
        }
        if (action === 'clone') {
          const parsed = parseArgs(rest, ['name', 'to-instance'])
          if (parsed.positionals.length !== 1) throw new Error('world clone requires one world')
          return operations.cloneWorld({
            world: parsed.positionals[0],
            name: one(parsed, 'name'),
            destination: one(parsed, 'to-instance'),
          }, signal)
        }
        if (action === 'link-server') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length !== 1) throw new Error('world link-server requires one world')
          return operations.linkWorldAsServer({ world: parsed.positionals[0] }, signal)
        }
        throw commandUsageError('Unknown world command.')
      },
    },
    {
      name: 'instance',
      usage: 'instance <list|create|diagnose|install|repair|manifest|duplicate|delete|import> ...',
      description: 'Inspect and manage launcher instances without changing the current Agent scope.',
      details: [
        'instance list',
        'instance create <name> [--description <text>] [--minecraft <version>] [--forge <version>] [--neoforge <version>] [--fabric <version>] [--quilt <version>] [--optifine <version>]',
        'instance runtime show',
        'instance runtime set [--minecraft <version>] [--loader <forge|neoforge|fabric|quilt> --loader-version <version> | --no-loader]',
        'instance diagnose',
        'instance install',
        'instance repair',
        'instance manifest status',
        'instance manifest apply',
        'instance manifest discard',
        'instance duplicate [instance-path]',
        'instance delete [instance-path] [--delete-data]',
        'instance import <modpack-path>',
      ],
      async execute(argv, signal) {
        const [action, ...rest] = argv
        if (action === 'list' && !rest.length) return operations.listInstances(signal)
        if (action === 'diagnose' && !rest.length) return operations.diagnoseInstance(signal)
        if (action === 'install' && !rest.length) return operations.installInstance(signal)
        if (action === 'repair' && !rest.length) return operations.repairInstance(signal)
        if (action === 'runtime' && rest[0] === 'show' && rest.length === 1) return operations.getInstanceRuntime(signal)
        if (action === 'runtime' && rest[0] === 'set') {
          const parsed = parseArgs(rest.slice(1), ['minecraft', 'loader', 'loader-version'], ['no-loader'])
          if (parsed.positionals.length) throw new Error('instance runtime set accepts only named options')
          const loaderName = one(parsed, 'loader')
          const loader = optionalLoader(loaderName)
          if (loaderName && !loader) throw new Error(`Unknown loader: ${loaderName}`)
          const loaderVersion = one(parsed, 'loader-version')
          const noLoader = parsed.booleans.has('no-loader')
          if (noLoader && (loader || loaderVersion)) throw new Error('--no-loader cannot be combined with --loader or --loader-version')
          if (!!loader !== !!loaderVersion) throw new Error('--loader and --loader-version must be specified together')
          const minecraft = one(parsed, 'minecraft')
          if (!minecraft && !loader && !noLoader) throw new Error('instance runtime set requires --minecraft, a loader pair, or --no-loader')
          return operations.setInstanceRuntime({ minecraft, loader, loaderVersion, noLoader }, signal)
        }
        if (action === 'manifest' && rest.length === 1) {
          if (rest[0] === 'status') return operations.getInstanceManifest(signal)
          if (rest[0] === 'apply') return operations.applyInstanceManifest(signal)
          if (rest[0] === 'discard') return operations.discardInstanceManifest(signal)
        }
        if (action === 'create') {
          const parsed = parseArgs(rest, ['description', 'minecraft', 'forge', 'neoforge', 'fabric', 'quilt', 'optifine'])
          if (parsed.positionals.length !== 1) throw new Error('instance create requires one name')
          const runtimeEntries = [
            ['minecraft', one(parsed, 'minecraft')],
            ['forge', one(parsed, 'forge')],
            ['neoForged', one(parsed, 'neoforge')],
            ['fabricLoader', one(parsed, 'fabric')],
            ['quiltLoader', one(parsed, 'quilt')],
            ['optifine', one(parsed, 'optifine')],
          ].filter((entry): entry is [string, string] => !!entry[1])
          if (runtimeEntries.length && !one(parsed, 'minecraft')) throw new Error('--minecraft is required when specifying a runtime')
          return operations.createInstance({
            name: parsed.positionals[0],
            description: one(parsed, 'description'),
            runtime: runtimeEntries.length ? Object.fromEntries(runtimeEntries) : undefined,
          }, signal)
        }
        if (action === 'duplicate') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length > 1) throw new Error('instance duplicate accepts at most one source')
          return operations.duplicateInstance({ source: parsed.positionals[0] }, signal)
        }
        if (action === 'delete') {
          const parsed = parseArgs(rest, [], ['delete-data'])
          if (parsed.positionals.length > 1) throw new Error('instance delete accepts at most one target')
          return operations.deleteInstance({ target: parsed.positionals[0], deleteData: parsed.booleans.has('delete-data') }, signal)
        }
        if (action === 'import') {
          const parsed = parseArgs(rest, [])
          if (parsed.positionals.length !== 1) throw new Error('instance import requires one modpack path')
          return operations.importModpack({ path: parsed.positionals[0] }, signal)
        }
        throw commandUsageError('Unknown instance command.')
      },
    },
    {
      name: 'ls',
      aliases: ['vfs_list'],
      usage: 'ls [virtual-path]',
      description: 'List a selected-instance virtual directory using the same handler as vfs_list.',
      details: [],
      async execute(argv, signal) {
        if (argv.length > 1) throw new Error('ls accepts at most one virtual path')
        return operations.listVfs(argv[0] ?? '', signal)
      },
    },
    {
      name: 'cat',
      aliases: ['vfs_read'],
      usage: 'cat <virtual-path> [--tail-lines <n>] [--offset <n>] [--limit <n>]',
      description: 'Read selected-instance virtual data using the same handler as vfs_read.',
      details: [],
      async execute(argv, signal) {
        const parsed = parseArgs(argv, ['tail-lines', 'offset', 'limit'])
        if (parsed.positionals.length !== 1) throw new Error('cat requires one virtual path')
        return operations.readVfs({
          path: parsed.positionals[0],
          tailLines: one(parsed, 'tail-lines') === undefined ? undefined : positiveInteger(one(parsed, 'tail-lines')!, 'cat tail-lines'),
          offset: one(parsed, 'offset') === undefined ? undefined : nonNegativeInteger(one(parsed, 'offset')!, 'cat offset'),
          limit: one(parsed, 'limit') === undefined ? undefined : positiveInteger(one(parsed, 'limit')!, 'cat limit'),
        }, signal)
      },
    },
    {
      name: 'rm',
      aliases: ['vfs_rm'],
      usage: 'rm <virtual-path>... | rm --paths <virtual-path[,virtual-path...]>',
      description: 'Remove or stage removal of selected-instance virtual paths using the same handler as vfs_rm.',
      details: [],
      async execute(argv, signal) {
        const parsed = parseArgs(argv, ['paths'])
        const paths = [
          ...parsed.positionals,
          ...(parsed.values.get('paths') ?? []).flatMap(value => value.split(',')),
        ].map(path => path.trim()).filter(Boolean)
        if (!paths.length) throw new Error('rm requires at least one virtual path')
        return operations.removeVfs(paths, signal)
      },
    },
    {
      name: 'grep',
      usage: 'grep [-i|--ignore-case] <pattern> [config/path|artifacts/path] [--offset <n>] [--limit <1-200>]',
      description: 'Search selected-instance config files or a temporary Agent artifact with a regular expression.',
      details: [],
      async execute(argv, signal) {
        const parsed = parseArgs(argv.map(token => token === '-i' ? '--ignore-case' : token), ['offset', 'limit'], ['ignore-case'])
        if (parsed.positionals.length < 1 || parsed.positionals.length > 2) throw new Error('grep requires a pattern and optional config path')
        const rawLimit = one(parsed, 'limit')
        const resultLimit = rawLimit === undefined ? undefined : positiveInteger(rawLimit, 'grep limit')
        if (resultLimit !== undefined && resultLimit > 200) throw new Error('grep limit must be between 1 and 200')
        return operations.grepConfig({
          pattern: parsed.positionals[0],
          path: parsed.positionals[1],
          ignoreCase: parsed.booleans.has('ignore-case'),
          offset: one(parsed, 'offset') === undefined ? undefined : nonNegativeInteger(one(parsed, 'offset')!, 'grep offset'),
          limit: resultLimit,
        }, signal)
      },
    },
    {
      name: 'mv',
      usage: 'mv <source> <destination>',
      description: 'Enable or disable one mod, resource pack, or shader pack through its virtual path.',
      details: [
        'mv mods/example.jar mods/example.jar.disabled',
        'mv mods/example.jar.disabled mods/example.jar',
      ],
      async execute(argv, signal) {
        const parsed = parseArgs(argv, [])
        if (parsed.positionals.length !== 2) throw new Error('mv requires a source and destination')
        return operations.moveResource({ source: parsed.positionals[0], destination: parsed.positionals[1] }, signal)
      },
    },
    {
      name: 'cp',
      usage: 'cp <mods/source> [mods/source...] server/mods/',
      description: 'Deploy explicitly selected installed mods into the local dedicated server.',
      details: [],
      async execute(argv, signal) {
        const parsed = parseArgs(argv, [])
        if (parsed.positionals.length < 2) throw new Error('cp requires at least one source and a destination')
        const destination = parsed.positionals.at(-1)!.replace(/\/$/, '')
        const sources = parsed.positionals.slice(0, -1)
        if (destination !== 'server/mods' || sources.some(path => !path.startsWith('mods/') || path.endsWith('/'))) {
          throw new Error('cp only supports installed mod paths copied to server/mods/')
        }
        return operations.deployServerMods({ compatible: false, paths: sources }, signal)
      },
    },
    {
      name: 'launch',
      usage: 'launch',
      description: 'Launch the selected Agent-scope instance with the active account.',
      details: [],
      async execute(argv, signal) {
        if (argv.length) throw new Error('launch does not accept arguments; the Agent scope is fixed')
        return operations.launchGame(signal)
      },
    },
    {
      name: 'wait',
      usage: 'wait --timeout <seconds> | wait --game-process <pid> [--timeout <seconds>]',
      description: 'Wait for a duration or until one selected-instance game process exits.',
      details: [
        'wait --timeout 5',
        'wait --game-process 12345',
        'wait --game-process 12345 --timeout 30',
      ],
      async execute(argv, signal) {
        const parsed = parseArgs(argv, ['timeout', 'game-process'])
        if (parsed.positionals.length) throw new Error('wait accepts only --timeout and --game-process')
        const timeout = one(parsed, 'timeout')
        const process = one(parsed, 'game-process')
        if (!timeout && !process) throw commandUsageError('wait requires --timeout or --game-process.')
        return operations.wait({
          timeoutSeconds: timeout ? positiveNumber(timeout, '--timeout') : undefined,
          gameProcess: process ? positiveInteger(process, '--game-process') : undefined,
        }, signal)
      },
    },
    {
      name: 'kill',
      usage: 'kill [--force]',
      description: 'Stop the selected instance Minecraft client process.',
      details: [],
      async execute(argv, signal) {
        const parsed = parseArgs(argv, [], ['force'])
        if (parsed.positionals.length) throw new Error('kill accepts only --force')
        return operations.stopGame({ force: parsed.booleans.has('force') }, signal)
      },
    },
    {
      name: 'ui',
      usage: 'ui navigate <path>',
      description: 'Navigate the launcher UI without changing the Agent instance or account scope.',
      details: [],
      async execute(argv, signal) {
        const [action, path, ...extra] = argv
        if (action === 'navigate' && path && !extra.length) return operations.navigateUi({ path }, signal)
        throw commandUsageError('Unknown ui command.')
      },
    },
    {
      name: 'server',
      usage: 'server <status|install|start|stop|mods deploy> [options]',
      description: 'Inspect and manage the selected instance local dedicated server.',
      details: [
        'server status',
        'server install',
        'server mods deploy --compatible',
        'server mods deploy --path <absolute-mod-path> [--path <absolute-mod-path>...]',
        'server start [--nogui]',
        'server stop [--force]',
      ],
      async execute(argv, signal) {
        const [action, subaction, ...rest] = argv
        if (action === 'status' && subaction === undefined) return operations.getServerStatus(signal)
        if (action === 'install' && subaction === undefined) return operations.installServer(signal)
        if (action === 'start') {
          const parsed = parseArgs(argv.slice(1), [], ['nogui'])
          if (parsed.positionals.length) throw new Error('server start accepts only --nogui')
          return operations.startServer({ nogui: parsed.booleans.has('nogui') }, signal)
        }
        if (action === 'stop') {
          const parsed = parseArgs(argv.slice(1), [], ['force'])
          if (parsed.positionals.length) throw new Error('server stop accepts only --force')
          return operations.stopServer({ force: parsed.booleans.has('force') }, signal)
        }
        if (action === 'mods' && subaction === 'deploy') {
          const parsed = parseArgs(rest, ['path'], ['compatible'])
          if (parsed.positionals.length) throw new Error('Use --path for each explicit mod file')
          const paths = parsed.values.get('path') ?? []
          const compatible = parsed.booleans.has('compatible')
          if (compatible === (paths.length > 0)) throw new Error('Provide exactly one of --compatible or --path')
          return operations.deployServerMods({ compatible, paths }, signal)
        }
        throw commandUsageError('Unknown server command.')
      },
    },
    {
      name: 'remote',
      usage: 'remote <status|test|service install|service uninstall|service start|service stop|service restart>',
      description: 'Inspect and manage the selected instance remote dedicated server.',
      details: [
        'remote status',
        'remote test',
        'remote service install',
        'remote service uninstall',
        'remote service start',
        'remote service stop',
        'remote service restart',
      ],
      async execute(argv, signal) {
        const [action, subaction, ...extra] = argv
        if (extra.length) throw commandUsageError('Unknown remote command.')
        if (action === 'status' && subaction === undefined) return operations.getRemoteServerStatus(signal)
        if (action === 'test' && subaction === undefined) return operations.testRemoteServerConnection(signal)
        if (action === 'service' && subaction === 'install') return operations.installRemoteServerService(signal)
        if (action === 'service' && subaction === 'uninstall') return operations.uninstallRemoteServerService(signal)
        if (action === 'service' && subaction === 'start') return operations.startRemoteServer(signal)
        if (action === 'service' && subaction === 'stop') return operations.stopRemoteServer(signal)
        if (action === 'service' && subaction === 'restart') return operations.restartRemoteServer(signal)
        throw commandUsageError('Unknown remote command.')
      },
    },
  ]
}
