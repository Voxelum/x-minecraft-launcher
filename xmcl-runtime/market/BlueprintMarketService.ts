import {
  BlueprintMarketInstallOptions,
  BlueprintMarketItem,
  BlueprintMarketSearchOptions,
  BlueprintMarketSearchResult,
  BlueprintMarketService as IBlueprintMarketService,
  BlueprintMarketServiceKey,
} from '@xmcl/runtime-api'
import { ensureDir, writeFile } from 'fs-extra'
import { join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'

const MCS_PAGE_SIZE = 15
const CMS_PAGE_SIZE = 20

const MCS_TYPE_EXT: Record<number, string> = {
  0: 'nbt',
  1: 'litematic',
  2: 'json',
  3: 'schem',
  4: 'mcstruct',
}

/**
 * Browse and install blueprints from mcschematic.top and
 * creativemechanicserver.com.
 */
@ExposeServiceKey(BlueprintMarketServiceKey)
export class BlueprintMarketService extends AbstractService implements IBlueprintMarketService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async search(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult> {
    if (options.provider === 'cms') {
      return this.searchCms(options)
    }
    return this.searchMcSchematic(options)
  }

  private async searchMcSchematic(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult> {
    const page = options.page ?? 0
    const url = new URL('https://www.mcschematic.top/api/schematics')
    url.searchParams.append('begin', String(page * MCS_PAGE_SIZE))
    url.searchParams.append('filter', options.keyword ?? '')
    url.searchParams.append('heatSort', options.sort === 'heat' ? 'true' : 'false')
    url.searchParams.append('type', '0')
    url.searchParams.append('t', String(Date.now()))

    const response = await this.app.fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`Failed to search mcschematic.top: ${response.status}`)
    }
    const json: any = await response.json()
    const list: any[] = Array.isArray(json) ? json : (json?.data ?? [])

    const items: BlueprintMarketItem[] = list.map((it) => ({
      id: String(it.uuid),
      provider: 'mcschematic' as const,
      title: it.name ?? it.uuid,
      author: it.nickName || it.author,
      description: it.description,
      icon: `https://www.mcschematic.top/api/preview?uuid=${it.uuid}`,
      size: formatSize(it.size),
      downloadCount: typeof it.heat === 'number' ? it.heat : undefined,
      fileType: MCS_TYPE_EXT[it.type] ?? 'schem',
      pageUrl: `https://www.mcschematic.top/home/${it.uuid}`,
      installable: true,
    }))

    return { items, page, hasMore: items.length >= MCS_PAGE_SIZE }
  }

  private async searchCms(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult> {
    const page = options.page ?? 0
    const form = new FormData()
    // These tokens are the public, hard-coded values used by McSTools' CMS
    // integration; the search endpoint accepts them anonymously.
    form.append('csrfmiddlewaretoken', 'jslSdvIXi6Xr7oTmLqLXa0ldpQRoYuGZCUk7dh4fws8EYwJC9EGiELBW4KsAaMWE')
    form.append('search_type', 't')
    form.append('q', options.keyword ?? '')
    form.append('consume', '')
    form.append('product', '')
    form.append('loader_type', 'any')
    form.append('mc_type', 'any')
    form.append('create_type', 'any')
    form.append('z_size', '')
    form.append('x_size', '')
    form.append('y_size', '')
    form.append('function', '')
    form.append('grid_col', '1')
    form.append('sort', options.sort && options.sort !== 'heat' ? options.sort : 'time')
    form.append('order', 'down')
    form.append('page', String(page))

    const response = await this.app.fetch('https://www.creativemechanicserver.com/search/', {
      method: 'POST',
      body: form as any,
      headers: {
        cookie: 'csrftoken=tC9paWwsowln1i0qyo5vEVqTP4LmmsqP',
        referer: 'https://www.creativemechanicserver.com/',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to search creativemechanicserver.com: ${response.status}`)
    }
    const html = await response.text()
    const items = parseCmsHtml(html)
    return { items, page, hasMore: items.length >= CMS_PAGE_SIZE }
  }

  async install(options: BlueprintMarketInstallOptions): Promise<string> {
    const { item, instancePath } = options
    if (item.provider !== 'mcschematic' || !item.installable) {
      throw new Error('This blueprint provider does not support direct install')
    }
    const response = await this.app.fetch(`https://mcschematic.top/api/schematicFile?uuid=${item.id}`)
    if (!response.ok) {
      throw new Error(`Failed to download blueprint: ${response.status}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const dir = join(instancePath, 'schematics')
    await ensureDir(dir)
    const ext = item.fileType ?? 'schem'
    const name = `${sanitize(item.title) || item.id}.${ext}`
    const dest = join(dir, name)
    await writeFile(dest, buffer)
    return dest
  }
}

function formatSize(size: unknown): string | undefined {
  if (typeof size !== 'string') return undefined
  try {
    const arr = JSON.parse(size)
    if (Array.isArray(arr) && arr.length >= 3) return `${arr[0]}×${arr[1]}×${arr[2]}`
  } catch {
    // CMS sizes use the form `10✖8✖12`.
    return size.replace(/✖/g, '×')
  }
  return size
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80)
}

function parseCmsHtml(html: string): BlueprintMarketItem[] {
  const items: BlueprintMarketItem[] = []
  const anchorRe = /<a\b([^>]*\bclass="[^"]*list_result[^"]*"[^>]*)>([\s\S]*?)<\/a>/g
  let match: RegExpExecArray | null
  while ((match = anchorRe.exec(html))) {
    const attrs = match[1]
    const inner = match[2]
    const idMatch = /href="\/detail\/(\d+)\//.exec(attrs) ?? /\/detail\/(\d+)\//.exec(inner)
    const id = idMatch?.[1]
    if (!id) continue
    const img = /<img[^>]*src="([^"]+)"/.exec(inner)?.[1]
    const name = textOf(inner, /<h2[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h2>/)
    const size = textOf(inner, /class="size"[^>]*>([\s\S]*?)</)?.replace('尺寸：', '').trim()
    const author = textOf(inner, /class="author"[^>]*>([\s\S]*?)</)?.replace('作者：', '').trim()
    const desc = textOf(inner, /class="desc"[^>]*>([\s\S]*?)</)
    const download = textOf(inner, /class="download"[^>]*>([\s\S]*?)</)
    items.push({
      id,
      provider: 'cms',
      title: name || `#${id}`,
      author,
      description: desc,
      icon: img ? (img.startsWith('http') ? img : `https://www.creativemechanicserver.com${img}`) : undefined,
      size: size?.replace(/✖/g, '×'),
      downloadCount: download ? Number(download.match(/\d+/)?.[0] ?? 0) : undefined,
      pageUrl: `https://www.creativemechanicserver.com/detail/${id}/`,
      installable: false,
    })
  }
  return items
}

function textOf(html: string, re: RegExp): string | undefined {
  const m = re.exec(html)
  if (!m) return undefined
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || undefined
}
