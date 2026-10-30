import type { BlueprintMarketSearchOptions, BlueprintMarketSearchResult } from '@xmcl/runtime-api'

const origin = 'https://www.mcschematic.top'
const pageSize = 15
const extensions: Record<string, string> = {
  create: 'nbt', building_gadgets: 'json', litematica: 'litematic',
  world_edit: 'schem', bedrock_edition: 'mcstructure', mcedit: 'schematic',
}

// Contract: https://www.mcschematic.top/api/v1/openapi.json?audience=developer
// Public discovery is anonymous; no website session or challenge workaround.
export async function searchMcSchematic(
  fetch: (url: string, init: { headers: Record<string, string> }) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>,
  options: BlueprintMarketSearchOptions,
): Promise<BlueprintMarketSearchResult> {
  const page = options.page ?? 0
  const url = new URL('/api/v1/blueprints', origin)
  url.searchParams.set('page', String(page + 1))
  url.searchParams.set('limit', String(pageSize))
  url.searchParams.set('q', options.keyword ?? '')
  url.searchParams.set('sort', options.sort === 'heat' ? 'popular' : 'latest')
  url.searchParams.set('extra', 'none')
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Failed to search mcschematic.top: ${response.status}`)
  const json = await response.json()
  if (!json || !Array.isArray(json.items) || !Number.isInteger(json.totalCount) || json.totalCount < 0) {
    throw new Error('Invalid mcschematic.top search response')
  }
  const items = json.items.map((it: any) => {
    if (typeof it?.id !== 'string' || typeof it.title !== 'string' || typeof it.slug !== 'string'
      || !Number.isInteger(it.currentVersion?.number) || it.currentVersion.number < 1) {
      throw new Error('Invalid mcschematic.top blueprint')
    }
    const ext = extensions[it.currentVersion.sourceFormat]
    return {
      id: it.id,
      provider: 'mcschematic' as const,
      title: it.title,
      author: it.author?.displayName,
      authorAvatar: it.author?.avatarUrl,
      description: it.description,
      icon: it.previewUrl ? new URL(it.previewUrl, origin).toString() : undefined,
      downloadCount: it.engagement?.downloadCount,
      tags: it.category ? [it.category.name] : undefined,
      uploadTime: it.updatedAt,
      fileType: ext,
      sourceVersion: it.currentVersion.number,
      pageUrl: `${origin}/blueprints/${encodeURIComponent(it.id)}/${encodeURIComponent(it.slug)}`,
      // Discovery knows more source formats than XMCL's blueprint reader.
      installable: ['create', 'building_gadgets', 'litematica', 'world_edit'].includes(it.currentVersion.sourceFormat),
    }
  })
  return { items, page, hasMore: (page + 1) * pageSize < json.totalCount }
}

export function mcSchematicDownloadUrl(id: string, version: number | undefined) {
  if (!Number.isInteger(version) || version! < 1) throw new Error('Blueprint version is missing; search again before installing')
  return `${origin}/api/v1/blueprints/${encodeURIComponent(id)}/versions/${version}/download`
}
