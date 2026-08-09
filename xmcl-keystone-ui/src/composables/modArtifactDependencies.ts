import { getRequiredModIdsFromArtifact } from './modInstall'

export type ArtifactLoader = 'forge' | 'neoforge' | 'fabric' | 'quilt'

export type ResolveArtifactModrinthDependencies = (
  url: string | undefined,
  selectedProjects: Set<string>,
  loaders: string[],
) => Promise<Array<{ versionId: string; icon: string | undefined }>>

interface InstalledModMetadata {
  modId: string
  provideRuntime: Record<string, string>
}

interface ModrinthDependencyClient {
  searchProjects(options: { query: string; facets: string; limit: number }): Promise<{
    hits: Array<{ slug: string; project_id: string; icon_url?: string }>
  }>
  getProjectVersions(projectId: string, options: { gameVersions: string[]; loaders: string[] }): Promise<Array<{ id: string }>>
}

interface ArtifactResponse {
  ok: boolean
  status: number
  arrayBuffer(): Promise<ArrayBuffer>
}

function normalizeModId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const intrinsicModIds = new Set(['minecraft', 'forge', 'neoforge', 'fabricloader', 'quiltloader', 'java'])

export async function resolveArtifactModrinthDependencies(options: {
  url: string | undefined
  loader: ArtifactLoader | undefined
  minecraft: string
  installedMods: readonly InstalledModMetadata[]
  selectedProjects: Set<string>
  client: ModrinthDependencyClient
  fetchArtifact?: (url: string) => Promise<ArtifactResponse>
  inspectArtifact?: (content: Uint8Array, loader: ArtifactLoader) => Promise<string[]>
}) {
  const { url, loader, minecraft, installedMods, selectedProjects, client } = options
  if (!url || !loader) return []
  const fetchArtifact = options.fetchArtifact ?? fetch
  const inspectArtifact = options.inspectArtifact ?? getRequiredModIdsFromArtifact
  try {
    const response = await fetchArtifact(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const requiredIds = await inspectArtifact(new Uint8Array(await response.arrayBuffer()), loader)
    const installedIds = new Set(installedMods
      .flatMap(mod => [mod.modId, ...Object.keys(mod.provideRuntime)])
      .map(normalizeModId))
    const versions = await Promise.all([...new Set(requiredIds)].map(async (modId) => {
      const normalizedId = normalizeModId(modId)
      if (intrinsicModIds.has(normalizedId) || installedIds.has(normalizedId)) return undefined
      const facets = JSON.stringify([
        ['project_type:mod'],
        [`versions:${minecraft}`],
        [`categories:${loader}`],
      ])
      const result = await client.searchProjects({ query: modId, facets, limit: 5 })
      const project = result.hits.find(hit => normalizeModId(hit.slug) === normalizedId)
      if (!project || selectedProjects.has(project.project_id)) return undefined
      const compatible = await client.getProjectVersions(project.project_id, {
        gameVersions: [minecraft],
        loaders: [loader],
      })
      const version = compatible[0]
      if (!version) return undefined
      selectedProjects.add(project.project_id)
      return { versionId: version.id, icon: project.icon_url }
    }))
    return versions.filter((version): version is NonNullable<typeof version> => !!version)
  } catch (error) {
    console.warn('[mod install] Failed to inspect artifact dependencies', error)
    return []
  }
}