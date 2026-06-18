import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Lazy-loaded marketplace tools. Triggered by `load_tools(["market_search"])`.
 *
 * Keep responses compact — searches return up to ~10 hits with the smallest
 * useful subset of fields. The agent can ask for full project / version
 * metadata follow-ups via the dedicated read tools.
 */
export function createMarketSearchTools(ctx: AgentContext): Tool[] {
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
  ]
}

function stripHtml(s: string | undefined): string {
  if (!s) return ''
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
