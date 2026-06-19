import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { MarketType } from '@xmcl/runtime-api'
import type { InstanceModsService, InstanceResourcePacksService, InstanceShaderPacksService, ModpackService } from '@xmcl/runtime-api'
import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Install services captured during agent setup and handed to the lazy market
 * pack. They cannot be obtained with `useService` at load time because the
 * pack is mounted mid-loop, outside any Vue injection context.
 */
export interface MarketInstallServices {
  instanceMods: Pick<InstanceModsService, 'installFromMarket'>
  resourcePackService: Pick<InstanceResourcePacksService, 'installFromMarket'>
  shaderPackService: Pick<InstanceShaderPacksService, 'installFromMarket'>
  modpackService: Pick<ModpackService, 'installModapckFromMarket'>
}

function parseInstallUri(uri: string):
  | { source: 'modrinth' | 'curseforge'; projectId: string; versionOrFileId: string; filename?: string }
  | { error: string } {
  // Format: `modrinth:<projectId>:<versionId>[:<filename>]`
  //         `curseforge:<projectId>:<fileId>[:<filename>]`
  const parts = uri.split(':')
  if (parts.length < 3) return { error: `invalid uri (need source:projectId:versionId): ${uri}` }
  const [source, projectId, versionOrFileId, ...rest] = parts
  if (source !== 'modrinth' && source !== 'curseforge') {
    return { error: `unknown source "${source}" (expected modrinth or curseforge)` }
  }
  if (!projectId || !versionOrFileId) return { error: `missing projectId or version/fileId in ${uri}` }
  const filename = rest.length ? rest.join(':') : undefined
  return { source, projectId, versionOrFileId, filename }
}

/**
 * Lazy-loaded marketplace tools. Triggered by `load_tools(["market"])`.
 *
 * Bundles read tools (search / project / versions) and the `install` action
 * for Modrinth + CurseForge. Keep responses compact — searches return up to
 * ~10 hits with the smallest useful subset of fields. The agent can ask for
 * full project / version metadata follow-ups via the dedicated read tools.
 */
export function createMarketTools(ctx: AgentContext, services: MarketInstallServices): Tool[] {
  // Use the current instance runtime when the agent omits a game version,
  // which is the common case for "find me a sodium-like mod" queries.
  function defaultGameVersion(): string | undefined {
    return ctx.instance.value.runtime.minecraft || undefined
  }

  return [
    {
      name: 'modrinth_search',
      readonly: true,
      description: 'Search Modrinth. Default project type is `mod`. Returns ~10 hits with project id, title, slug, description, downloads, and supported loaders / game versions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          projectType: { type: 'string', enum: ['mod', 'resourcepack', 'shader', 'modpack', 'datapack'], description: 'Default: mod' },
          gameVersion: { type: 'string', description: 'Defaults to current instance minecraft version' },
          loaders: { type: 'array', items: { type: 'string' }, description: 'e.g. ["fabric"], ["forge"], ["neoforge"]' },
          categories: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number', description: 'Default 10, max 30' },
        },
        required: ['query'],
      },
      async execute(args, signal) {
        const facets: string[][] = []
        const pt = String(args.projectType ?? 'mod')
        facets.push([`project_type:${pt}`])
        const gv = String(args.gameVersion ?? defaultGameVersion() ?? '')
        if (gv) facets.push([`versions:${gv}`])
        const loaders = (args.loaders as string[] | undefined) ?? []
        if (loaders.length) facets.push(loaders.map((l) => `categories:${l}`))
        const cats = (args.categories as string[] | undefined) ?? []
        if (cats.length) facets.push(cats.map((c) => `categories:${c}`))
        const limit = Math.min(Number(args.limit ?? 10) || 10, 30)
        const res = await clientModrinthV2.searchProjects({
          query: String(args.query ?? ''),
          limit,
          facets: JSON.stringify(facets),
        }, signal)
        return {
          totalHits: res.total_hits,
          hits: res.hits.map((h) => ({
            projectId: h.project_id,
            slug: h.slug,
            title: h.title,
            description: h.description,
            downloads: h.downloads,
            loaders: h.categories,
            versions: h.versions?.slice(0, 4),
            latestVersion: h.latest_version,
          })),
        }
      },
    },
    {
      name: 'modrinth_project',
      readonly: true,
      description: 'Get full Modrinth project metadata (description body, links, categories, supported loaders).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string', description: 'Project id or slug' } },
        required: ['projectId'],
      },
      async execute(args, signal) {
        const p = await clientModrinthV2.getProject(String(args.projectId ?? ''), signal)
        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          body: p.body?.slice(0, 4000),
          categories: p.categories,
          loaders: p.loaders,
          gameVersions: p.game_versions,
          clientSide: p.client_side,
          serverSide: p.server_side,
          downloads: p.downloads,
          license: p.license?.id,
          sourceUrl: p.source_url,
          issuesUrl: p.issues_url,
        }
      },
    },
    {
      name: 'modrinth_versions',
      readonly: true,
      description: 'List Modrinth project versions filtered by loader/game version. Returns version id, filename, primary file size, dependencies — ready to feed into `install`.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          loaders: { type: 'array', items: { type: 'string' } },
          gameVersions: { type: 'array', items: { type: 'string' } },
        },
        required: ['projectId'],
      },
      async execute(args, signal) {
        const versions = await clientModrinthV2.getProjectVersions(
          String(args.projectId ?? ''),
          {
            loaders: (args.loaders as string[] | undefined),
            gameVersions: (args.gameVersions as string[] | undefined) ?? (defaultGameVersion() ? [defaultGameVersion()!] : undefined),
          },
          signal,
        )
        return versions.slice(0, 20).map((v) => {
          const primary = v.files.find((f) => f.primary) ?? v.files[0]
          return {
            versionId: v.id,
            name: v.name,
            versionNumber: v.version_number,
            datePublished: v.date_published,
            loaders: v.loaders,
            gameVersions: v.game_versions,
            primaryFile: primary && { filename: primary.filename, sizeBytes: primary.size, url: primary.url },
            installUri: primary
              ? `modrinth:${args.projectId}:${v.id}:${primary.filename}`
              : `modrinth:${args.projectId}:${v.id}`,
          }
        })
      },
    },
    {
      name: 'curseforge_search',
      readonly: true,
      description: 'Search CurseForge. Returns ~10 hits with mod id, name, summary, downloadCount and latest files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          classId: { type: 'number', description: '6=mods, 12=resourcepacks, 6552=shaders, 4471=modpacks, 17=worlds' },
          gameVersion: { type: 'string' },
          limit: { type: 'number', description: 'Default 10, max 30' },
        },
        required: ['query'],
      },
      async execute(args, signal) {
        const res = await clientCurseforgeV1.searchMods({
          searchFilter: String(args.query ?? ''),
          classId: Number(args.classId ?? 6),
          gameVersion: String(args.gameVersion ?? defaultGameVersion() ?? '') || undefined,
          pageSize: Math.min(Number(args.limit ?? 10) || 10, 30),
        }, signal)
        return {
          totalCount: res.pagination.totalCount,
          hits: res.data.map((m) => ({
            modId: m.id,
            slug: m.slug,
            name: m.name,
            summary: m.summary,
            downloadCount: m.downloadCount,
            categories: m.categories?.map((c) => c.name),
            latestFile: m.latestFiles?.[0] && {
              fileId: m.latestFiles[0].id,
              filename: m.latestFiles[0].fileName,
              gameVersions: m.latestFiles[0].gameVersions,
            },
          })),
        }
      },
    },
    {
      name: 'curseforge_project',
      readonly: true,
      description: 'Get full CurseForge project metadata + description (HTML stripped).',
      parameters: {
        type: 'object',
        properties: { modId: { type: 'number' } },
        required: ['modId'],
      },
      async execute(args, signal) {
        const id = Number(args.modId ?? 0)
        const [m, desc] = await Promise.all([
          clientCurseforgeV1.getMod(id, signal),
          clientCurseforgeV1.getModDescription(id, signal).catch(() => ''),
        ])
        return {
          modId: m.id,
          slug: m.slug,
          name: m.name,
          summary: m.summary,
          downloadCount: m.downloadCount,
          categories: m.categories?.map((c) => c.name),
          description: stripHtml(desc).slice(0, 4000),
          latestFiles: m.latestFiles?.slice(0, 5).map((f) => ({
            fileId: f.id,
            filename: f.fileName,
            gameVersions: f.gameVersions,
            releaseType: f.releaseType,
            installUri: `curseforge:${id}:${f.id}:${f.fileName}`,
          })),
        }
      },
    },
    {
      name: 'curseforge_files',
      readonly: true,
      description: 'List CurseForge files for a mod, filtered by gameVersion. Returns fileId, filename, releaseType, gameVersions and a ready-to-use `installUri`.',
      parameters: {
        type: 'object',
        properties: {
          modId: { type: 'number' },
          gameVersion: { type: 'string' },
        },
        required: ['modId'],
      },
      async execute(args, signal) {
        const id = Number(args.modId ?? 0)
        const res = await clientCurseforgeV1.getModFiles({
          modId: id,
          gameVersion: String(args.gameVersion ?? defaultGameVersion() ?? '') || undefined,
          pageSize: 20,
        }, signal)
        return res.data.map((f) => ({
          fileId: f.id,
          filename: f.fileName,
          fileLength: f.fileLength,
          releaseType: f.releaseType,
          gameVersions: f.gameVersions,
          installUri: `curseforge:${id}:${f.id}:${f.fileName}`,
        }))
      },
    },
    {
      name: 'install',
      description: [
        'Install resources from a market URI into the current instance.',
        'URI format: `<source>:<projectId>:<versionOrFileId>[:<filename>]`',
        '  modrinth: `modrinth:<projectId>:<versionId>[:<filename>]`',
        '  curseforge: `curseforge:<projectId>:<fileId>[:<filename>]`',
        'Specify `target` as `mods`, `resourcepacks`, `shaderpacks`, or `modpack`. The `modpack` target downloads but does NOT auto-create the instance.',
      ].join('\n'),
      parameters: {
        type: 'object',
        properties: {
          uris: { type: 'array', items: { type: 'string' } },
          target: { type: 'string', enum: ['mods', 'resourcepacks', 'shaderpacks', 'modpack'] },
        },
        required: ['uris', 'target'],
      },
      async execute(args) {
        const uris = (args.uris as string[] | undefined) ?? []
        const target = String(args.target ?? '')
        if (!uris.length) return { error: 'uris is empty' }
        const inst = ctx.instance.value.path
        if (target !== 'modpack' && !inst) return { error: 'no instance selected' }

        const modrinthVersions: { versionId: string; filename?: string }[] = []
        const curseforgeFiles: { fileId: number }[] = []
        const errors: string[] = []
        for (const uri of uris) {
          const parsed = parseInstallUri(uri)
          if ('error' in parsed) { errors.push(parsed.error); continue }
          if (parsed.source === 'modrinth') {
            modrinthVersions.push({ versionId: parsed.versionOrFileId, filename: parsed.filename })
          } else {
            const id = Number(parsed.versionOrFileId)
            if (!Number.isFinite(id)) { errors.push(`bad curseforge fileId: ${parsed.versionOrFileId}`); continue }
            curseforgeFiles.push({ fileId: id })
          }
        }
        if (errors.length && !modrinthVersions.length && !curseforgeFiles.length) {
          return { errors }
        }

        const results: Record<string, unknown> = {}

        if (target === 'modpack') {
          if (modrinthVersions.length) {
            results.modrinth = await services.modpackService.installModapckFromMarket({
              market: MarketType.Modrinth,
              version: modrinthVersions,
            })
          }
          if (curseforgeFiles.length) {
            results.curseforge = await services.modpackService.installModapckFromMarket({
              market: MarketType.CurseForge,
              file: curseforgeFiles,
            })
          }
        } else {
          const service = target === 'mods'
            ? services.instanceMods
            : target === 'resourcepacks'
              ? services.resourcePackService
              : target === 'shaderpacks'
                ? services.shaderPackService
                : undefined
          if (!service) return { error: `unknown target: ${target}` }
          if (modrinthVersions.length) {
            results.modrinth = await service.installFromMarket({
              instancePath: inst,
              market: MarketType.Modrinth,
              version: modrinthVersions,
            })
          }
          if (curseforgeFiles.length) {
            results.curseforge = await service.installFromMarket({
              instancePath: inst,
              market: MarketType.CurseForge,
              file: curseforgeFiles,
            })
          }
        }

        if (errors.length) results.errors = errors
        return { ok: true, ...results }
      },
    },
  ]
}

function stripHtml(s: string | undefined): string {
  if (!s) return ''
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
