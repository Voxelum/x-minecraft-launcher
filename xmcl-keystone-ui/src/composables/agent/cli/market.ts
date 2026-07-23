import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { getInstanceFileFromModrinthVersion } from '@/util/modrinth'
import type { Instance } from '@xmcl/instance'
import { MarketType, type ModpackService } from '@xmcl/runtime-api'
import type { InstanceChangeOperations } from '../instanceChanges'
import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

const MARKET_USAGE = 'market <modrinth|curseforge|install> ...'
const PROJECT_TYPES = ['mod', 'resourcepack', 'shader', 'modpack', 'datapack'] as const
const MODRINTH_SORTS = ['relevance', 'downloads', 'follows', 'newest', 'updated'] as const
const TARGETS = ['mods', 'resourcepacks', 'shaderpacks', 'modpack'] as const
const SORT_ORDERS = ['asc', 'desc'] as const

type InstallTarget = typeof TARGETS[number]

interface PageOptions {
  page?: number
  pageSize?: number
}

export interface MarketCliOperations {
  modrinthSearch(options: { query: string; projectType?: string; gameVersion?: string; loaders?: string[]; categories?: string[]; sort?: string } & PageOptions, signal?: AbortSignal): Promise<unknown>
  modrinthProject(projectId: string, signal?: AbortSignal): Promise<unknown>
  modrinthVersions(options: { projectId: string; loaders?: string[]; gameVersions?: string[] } & PageOptions, signal?: AbortSignal): Promise<unknown>
  curseforgeSearch(options: { query: string; classId?: number; categoryId?: number; gameVersion?: string; sortField?: number; sortOrder?: 'asc' | 'desc' } & PageOptions, signal?: AbortSignal): Promise<unknown>
  curseforgeProject(modId: number, signal?: AbortSignal): Promise<unknown>
  curseforgeFiles(options: { modId: number; gameVersion?: string } & PageOptions, signal?: AbortSignal): Promise<unknown>
  install(target: InstallTarget, uris: string[], signal?: AbortSignal): Promise<unknown>
}

function pageValues(options: PageOptions) {
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 10
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function pagination(total: number, page: number, pageSize: number, resultCount: number) {
  const totalPages = Math.ceil(total / pageSize)
  return {
    page,
    pageSize,
    resultCount,
    totalCount: total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  }
}

function parseInstallUri(uri: string):
  | { source: 'modrinth' | 'curseforge'; projectId: string; versionOrFileId: string; filename?: string }
  | { error: string } {
  const parts = uri.split(':')
  if (parts.length < 3) return { error: `invalid uri (need source:projectId:versionId): ${uri}` }
  const [source, projectId, versionOrFileId, ...rest] = parts
  if (source !== 'modrinth' && source !== 'curseforge') return { error: `unknown source "${source}" (expected modrinth or curseforge)` }
  if (!projectId || !versionOrFileId) return { error: `missing projectId or version/fileId in ${uri}` }
  return { source, projectId, versionOrFileId, filename: rest.length ? rest.join(':') : undefined }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function createMarketCliOperations(options: {
  currentInstance: () => Instance
  instanceChanges: InstanceChangeOperations
  modpackService: Pick<ModpackService, 'installModapckFromMarket'>
}): MarketCliOperations {
  const { currentInstance, instanceChanges, modpackService } = options
  const defaultGameVersion = () => currentInstance().runtime.minecraft || undefined

  async function modrinthSearch(search: Parameters<MarketCliOperations['modrinthSearch']>[0], signal?: AbortSignal) {
    const facets: string[][] = [[`project_type:${search.projectType ?? 'mod'}`]]
    const gameVersion = search.gameVersion ?? defaultGameVersion()
    if (gameVersion) facets.push([`versions:${gameVersion}`])
    if (search.loaders?.length) facets.push(search.loaders.map((loader) => `categories:${loader}`))
    if (search.categories?.length) facets.push(search.categories.map((category) => `categories:${category}`))
    const { page, pageSize, offset } = pageValues(search)
    const result = await clientModrinthV2.searchProjects({
      query: search.query,
      facets: JSON.stringify(facets),
      index: search.sort,
      offset,
      limit: pageSize,
    }, signal)
    return {
      pagination: pagination(result.total_hits, page, pageSize, result.hits.length),
      projects: result.hits,
    }
  }

  async function modrinthProject(projectId: string, signal?: AbortSignal) {
    return clientModrinthV2.getProject(projectId, signal)
  }

  async function modrinthVersions(request: Parameters<MarketCliOperations['modrinthVersions']>[0], signal?: AbortSignal) {
    const versions = await clientModrinthV2.getProjectVersions(request.projectId, {
      loaders: request.loaders,
      gameVersions: request.gameVersions ?? (defaultGameVersion() ? [defaultGameVersion()!] : undefined),
    }, signal)
    const { page, pageSize, offset } = pageValues(request)
    const selected = versions.slice(offset, offset + pageSize)
    return {
      pagination: pagination(versions.length, page, pageSize, selected.length),
      versions: selected.map((version) => ({
        ...version,
        installUris: version.files.map((file) => `modrinth:${request.projectId}:${version.id}:${file.filename}`),
      })),
    }
  }

  async function curseforgeSearch(search: Parameters<MarketCliOperations['curseforgeSearch']>[0], signal?: AbortSignal) {
    const { page, pageSize, offset } = pageValues(search)
    const result = await clientCurseforgeV1.searchMods({
      searchFilter: search.query,
      classId: search.classId ?? 6,
      categoryId: search.categoryId,
      gameVersion: search.gameVersion ?? defaultGameVersion(),
      sortField: search.sortField,
      sortOrder: search.sortOrder,
      index: offset,
      pageSize,
    }, signal)
    return {
      pagination: pagination(result.pagination.totalCount, page, pageSize, result.data.length),
      projects: result.data,
    }
  }

  async function curseforgeProject(modId: number, signal?: AbortSignal) {
    const [project, descriptionHtml] = await Promise.all([
      clientCurseforgeV1.getMod(modId, signal),
      clientCurseforgeV1.getModDescription(modId, signal).catch(() => ''),
    ])
    return { project, descriptionHtml, descriptionText: stripHtml(descriptionHtml) }
  }

  async function curseforgeFiles(request: Parameters<MarketCliOperations['curseforgeFiles']>[0], signal?: AbortSignal) {
    const { page, pageSize, offset } = pageValues(request)
    const result = await clientCurseforgeV1.getModFiles({
      modId: request.modId,
      gameVersion: request.gameVersion ?? defaultGameVersion(),
      index: offset,
      pageSize,
    }, signal)
    return {
      pagination: pagination(result.pagination.totalCount, page, pageSize, result.data.length),
      files: result.data.map((file) => ({ ...file, installUri: `curseforge:${request.modId}:${file.id}:${file.fileName}` })),
    }
  }

  async function install(target: InstallTarget, uris: string[], signal?: AbortSignal) {
    if (!uris.length) return { error: 'uris is empty' }
    if (target !== 'modpack' && !currentInstance().path) return { error: 'no instance selected' }

    const modrinthVersions: { versionId: string; filename?: string }[] = []
    const curseforgeFiles: { fileId: number }[] = []
    const errors: string[] = []
    const skippedDuplicateUris: string[] = []
    const seenProjects = new Set<string>()
    for (const uri of uris) {
      const parsed = parseInstallUri(uri)
      if ('error' in parsed) { errors.push(parsed.error); continue }
      const projectKey = `${parsed.source}:${parsed.projectId}`
      if (seenProjects.has(projectKey)) { skippedDuplicateUris.push(uri); continue }
      seenProjects.add(projectKey)
      if (parsed.source === 'modrinth') {
        modrinthVersions.push({ versionId: parsed.versionOrFileId, filename: parsed.filename })
      } else {
        const fileId = Number(parsed.versionOrFileId)
        if (!Number.isSafeInteger(fileId) || fileId <= 0) { errors.push(`bad curseforge fileId: ${parsed.versionOrFileId}`); continue }
        curseforgeFiles.push({ fileId })
      }
    }
    if (errors.length && !modrinthVersions.length && !curseforgeFiles.length) return { errors }

    const results: Record<string, unknown> = {}
    if (target === 'modpack') {
      if (modrinthVersions.length) results.modrinth = await modpackService.installModapckFromMarket({ market: MarketType.Modrinth, version: modrinthVersions })
      if (curseforgeFiles.length) results.curseforge = await modpackService.installModapckFromMarket({ market: MarketType.CurseForge, file: curseforgeFiles })
    } else {
      const [versions, files] = await Promise.all([
        modrinthVersions.length ? clientModrinthV2.getProjectVersionsById(modrinthVersions.map(({ versionId }) => versionId), signal) : Promise.resolve([]),
        curseforgeFiles.length ? clientCurseforgeV1.getFiles(curseforgeFiles.map(({ fileId }) => fileId), signal) : Promise.resolve([]),
      ])
      const filenames = new Map(modrinthVersions.map(({ versionId, filename }) => [versionId, filename]))
      const instanceFiles = [
        ...versions.map((version) => getInstanceFileFromModrinthVersion(version, target, filenames.get(version.id))),
        ...files.map((file) => getInstanceFileFromCurseforgeFile(file, target)),
      ]
      if (!instanceFiles.length) return { error: 'no market files resolved from the provided URIs', ...(errors.length ? { errors } : {}) }
      results.change = await instanceChanges.add({ label: `install ${target} from market`, oldFiles: [], files: instanceFiles })
    }
    if (errors.length) results.errors = errors
    if (skippedDuplicateUris.length) results.skippedDuplicateUris = skippedDuplicateUris
    return { ok: true, ...results }
  }

  return { modrinthSearch, modrinthProject, modrinthVersions, curseforgeSearch, curseforgeProject, curseforgeFiles, install }
}

type ParsedOptions = { positionals: string[]; options: Map<string, string[]> } | { error: string }

function parseOptions(argv: string[], allowed: readonly string[]): ParsedOptions {
  const positionals: string[] = []
  const options = new Map<string, string[]>()
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (!token.startsWith('--')) { positionals.push(token); continue }
    const name = token.slice(2)
    if (!allowed.includes(name)) return { error: `unknown option: ${token}` }
    const value = argv[++index]
    if (!value || value.startsWith('--')) return { error: `missing value for ${token}` }
    const values = options.get(name) ?? []
    values.push(value)
    options.set(name, values)
  }
  return { positionals, options }
}

function one(parsed: Exclude<ParsedOptions, { error: string }>, name: string) {
  return parsed.options.get(name)?.at(-1)
}

function many(parsed: Exclude<ParsedOptions, { error: string }>, name: string) {
  return parsed.options.get(name)
}

function positiveInteger(value: string | undefined, name: string, fallback?: number): number | { error: string } | undefined {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : { error: `${name} must be a positive integer` }
}

function readPage(parsed: Exclude<ParsedOptions, { error: string }>) {
  const page = positiveInteger(one(parsed, 'page'), '--page', 1)
  if (typeof page !== 'number') return page
  const pageSize = positiveInteger(one(parsed, 'page-size'), '--page-size', 10)
  if (typeof pageSize !== 'number') return pageSize
  if (pageSize > 50) return { error: '--page-size cannot exceed 50' }
  return { page, pageSize }
}

export function createMarketCommand(cli: CliContext, operations: MarketCliOperations): VirtualCliCommand {
  return {
    name: 'market',
    usage: MARKET_USAGE,
    description: 'Search, inspect, paginate, and install Modrinth or CurseForge content.',
    help: [
      'Quote search queries containing spaces.',
      '`market modrinth search <query> [--type <mod|resourcepack|shader|modpack|datapack>] [--game-version <version>] [--loader <loader>]... [--category <category>]... [--sort <relevance|downloads|follows|newest|updated>] [--page <n>] [--page-size <1-50>]`',
      '`market modrinth project <projectId>`',
      '`market modrinth versions <projectId> [--game-version <version>]... [--loader <loader>]... [--page <n>] [--page-size <1-50>]`',
      '`market curseforge search <query> [--class-id <id>] [--category-id <id>] [--game-version <version>] [--sort-field <1-8>] [--sort-order <asc|desc>] [--page <n>] [--page-size <1-50>]`',
      '`market curseforge project <modId>`',
      '`market curseforge files <modId> [--game-version <version>] [--page <n>] [--page-size <1-50>]`',
      '`market install <mods|resourcepacks|shaderpacks|modpack> <installUri>...` adds resources to the instance change list; modpacks retain their separate download flow.',
      'Search, version, and file responses include pagination metadata and complete API records. Use the returned `installUris` or `installUri` values with `market install`.',
    ],
    execute: async (argv, signal) => {
      const [source, action, ...rest] = argv
      if (source === 'install') {
        const target = action as InstallTarget
        if (!TARGETS.includes(target)) return usageError(MARKET_USAGE, `unknown install target: ${action ?? ''}`)
        return operations.install(target, rest, signal)
      }
      if (source !== 'modrinth' && source !== 'curseforge') return usageError(MARKET_USAGE, `unknown market source: ${source ?? ''}`)

      if (source === 'modrinth' && action === 'project') {
        if (rest.length !== 1) return usageError(MARKET_USAGE, 'modrinth project expects one project id')
        return operations.modrinthProject(rest[0], signal)
      }
      if (source === 'curseforge' && action === 'project') {
        if (rest.length !== 1) return usageError(MARKET_USAGE, 'curseforge project expects one mod id')
        const modId = positiveInteger(rest[0], 'modId')
        if (typeof modId !== 'number') return usageError(MARKET_USAGE, modId?.error)
        return operations.curseforgeProject(modId, signal)
      }

      const allowed = source === 'modrinth'
        ? action === 'search'
          ? ['type', 'game-version', 'loader', 'category', 'sort', 'page', 'page-size']
          : ['game-version', 'loader', 'page', 'page-size']
        : action === 'search'
          ? ['class-id', 'category-id', 'game-version', 'sort-field', 'sort-order', 'page', 'page-size']
          : ['game-version', 'page', 'page-size']
      if (action !== 'search' && action !== (source === 'modrinth' ? 'versions' : 'files')) return usageError(MARKET_USAGE, `unknown ${source} operation: ${action ?? ''}`)
      const parsed = parseOptions(rest, allowed)
      if ('error' in parsed) return usageError(MARKET_USAGE, parsed.error)
      if (parsed.positionals.length !== 1) return usageError(MARKET_USAGE, `${source} ${action} expects exactly one query or id`)
      const page = readPage(parsed)
      if (!page || 'error' in page) return usageError(MARKET_USAGE, page?.error ?? 'invalid pagination')

      if (source === 'modrinth' && action === 'search') {
        const projectType = one(parsed, 'type')
        if (projectType && !PROJECT_TYPES.includes(projectType as typeof PROJECT_TYPES[number])) return usageError(MARKET_USAGE, `invalid project type: ${projectType}`)
        const sort = one(parsed, 'sort')
        if (sort && !MODRINTH_SORTS.includes(sort as typeof MODRINTH_SORTS[number])) return usageError(MARKET_USAGE, `invalid Modrinth sort: ${sort}`)
        return operations.modrinthSearch({ query: parsed.positionals[0], projectType, gameVersion: one(parsed, 'game-version'), loaders: many(parsed, 'loader'), categories: many(parsed, 'category'), sort, ...page }, signal)
      }
      if (source === 'modrinth') {
        return operations.modrinthVersions({ projectId: parsed.positionals[0], gameVersions: many(parsed, 'game-version'), loaders: many(parsed, 'loader'), ...page }, signal)
      }
      if (action === 'search') {
        const classId = positiveInteger(one(parsed, 'class-id'), '--class-id')
        if (classId && typeof classId !== 'number') return usageError(MARKET_USAGE, classId.error)
        const categoryId = positiveInteger(one(parsed, 'category-id'), '--category-id')
        if (categoryId && typeof categoryId !== 'number') return usageError(MARKET_USAGE, categoryId.error)
        const sortField = positiveInteger(one(parsed, 'sort-field'), '--sort-field')
        if (sortField && typeof sortField !== 'number') return usageError(MARKET_USAGE, sortField.error)
        if (typeof sortField === 'number' && sortField > 8) return usageError(MARKET_USAGE, '--sort-field must be between 1 and 8')
        const sortOrder = one(parsed, 'sort-order') as 'asc' | 'desc' | undefined
        if (sortOrder && !SORT_ORDERS.includes(sortOrder)) return usageError(MARKET_USAGE, `invalid sort order: ${sortOrder}`)
        return operations.curseforgeSearch({ query: parsed.positionals[0], classId, categoryId, gameVersion: one(parsed, 'game-version'), sortField, sortOrder, ...page }, signal)
      }
      const modId = positiveInteger(parsed.positionals[0], 'modId')
      if (typeof modId !== 'number') return usageError(MARKET_USAGE, modId?.error)
      return operations.curseforgeFiles({ modId, gameVersion: one(parsed, 'game-version'), ...page }, signal)
    },
  }
}
