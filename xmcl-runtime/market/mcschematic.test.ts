import { describe, expect, it, vi } from 'vitest'
import { searchMcSchematic, mcSchematicDownloadUrl } from './mcschematic'

const blueprint = {
  id: 'public-id', slug: 'public-blueprint', title: 'Public blueprint', author: { displayName: 'Creator' },
  currentVersion: { number: 2, sourceFormat: 'litematica' },
  previewUrl: '/api/v1/blueprints/public-id/versions/2/preview',
  engagement: { downloadCount: 12 }, category: { name: 'Farms' }, updatedAt: '2026-10-29',
}
const options = { provider: 'mcschematic' as const }
describe('MCS documented v1 public contract', () => {
  it('maps one-based pagination, search, sort and public-only discovery', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [blueprint], totalCount: 31 })))
    const result = await searchMcSchematic(fetch, { ...options, page: 1, keyword: 'farm & tree', sort: 'heat' })
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://www.mcschematic.top/api/v1/blueprints')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', limit: '15', q: 'farm & tree', sort: 'popular', extra: 'none' })
    expect(result).toMatchObject({ page: 1, hasMore: true, items: [{ id: 'public-id', author: 'Creator', fileType: 'litematic', sourceVersion: 2, installable: true }] })
    expect(result.items[0].icon).toBe('https://www.mcschematic.top' + blueprint.previewUrl)
    expect(mcSchematicDownloadUrl(result.items[0].id, result.items[0].sourceVersion)).toBe('https://www.mcschematic.top/api/v1/blueprints/public-id/versions/2/download')
  })
  it.each([404, 429, 503])('rejects HTTP %s, never presenting it as an empty result', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response('unavailable', { status }))
    await expect(searchMcSchematic(fetch, options)).rejects.toThrow(String(status))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each([{}, [], { data: [] }, { items: [], totalCount: -1 }, { items: [{}], totalCount: 1 }])('rejects incompatible successful payload %j', async body => {
    await expect(searchMcSchematic(vi.fn().mockResolvedValue(new Response(JSON.stringify(body))), options)).rejects.toThrow('Invalid mcschematic.top')
  })
  it.each([
    ['create', 'nbt', true], ['building_gadgets', 'json', true],
    ['litematica', 'litematic', true], ['world_edit', 'schem', true],
    ['mcedit', 'schematic', false], ['bedrock_edition', 'mcstructure', false],
  ])('only enables install for reader-supported format %s', async (format, extension, installable) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ ...blueprint, currentVersion: { number: 1, sourceFormat: format } }], totalCount: 1,
    })))
    expect((await searchMcSchematic(fetch, options)).items[0]).toMatchObject({ fileType: extension, installable })
  })
  it('handles final/empty pages and unknown formats without unsafe direct install', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [], totalCount: 0 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ ...blueprint, currentVersion: { number: 1, sourceFormat: 'future' } }], totalCount: 1 })))
    expect(await searchMcSchematic(fetch, options)).toEqual({ items: [], page: 0, hasMore: false })
    expect((await searchMcSchematic(fetch, options)).items[0].installable).toBe(false)
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('sort')).toBe('latest')
    expect(() => mcSchematicDownloadUrl('id', undefined)).toThrow('search again')
  })
})
