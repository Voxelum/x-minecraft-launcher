import {
  BlueprintMarketInstallOptions,
  BlueprintMarketItem,
  BlueprintMarketSearchOptions,
  BlueprintMarketSearchResult,
  BlueprintMarketService as IBlueprintMarketService,
  BlueprintMarketServiceKey,
  InstallBlueprintTask,
} from '@xmcl/runtime-api'
import { ensureDir, writeFile } from 'fs-extra'
import { join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kTasks, Tasks } from '~/infra'
import { searchMcSchematic, mcSchematicDownloadUrl } from './mcschematic'
import { LauncherApp } from '../app/LauncherApp'

const CMS_PAGE_SIZE = 20

// minecraft-schematics.com sits behind a Cloudflare challenge that rejects
// non-browser clients, so requests must present a realistic browser UA.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * Browse and install blueprints from mcschematic.top,
 * creativemechanicserver.com and minecraft-schematics.com.
 */
@ExposeServiceKey(BlueprintMarketServiceKey)
export class BlueprintMarketService extends AbstractService implements IBlueprintMarketService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(app)
  }

  async search(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult> {
    if (options.provider === 'cms') {
      return this.searchCms(options)
    }
    if (options.provider === 'minecraft-schematics') {
      return this.searchMinecraftSchematics(options)
    }
    return this.searchMcSchematic(options)
  }

  private async searchMcSchematic(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult> {
    return searchMcSchematic((url, init) => this.app.fetch(url, init), options)
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

  private async searchMinecraftSchematics(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult> {
    const page = options.page ?? 0
    // The search results page is not paginated, so only the first page yields
    // items; further pages are empty. This provider is browse-only.
    if (page > 0) {
      return { items: [], page, hasMore: false }
    }
    const url = new URL('https://www.minecraft-schematics.com/')
    url.searchParams.append('search', options.keyword ?? '')
    url.searchParams.append('category', '')
    url.searchParams.append('theme', '')
    url.searchParams.append('size', '')
    url.searchParams.append('rating', '')
    url.searchParams.append('order', '')

    const response = await this.app.fetch(url.toString(), {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to search minecraft-schematics.com: ${response.status}`)
    }
    const html = await response.text()
    const items = parseMinecraftSchematicsHtml(html)
    return { items, page, hasMore: false }
  }

  async install(options: BlueprintMarketInstallOptions): Promise<string> {
    const { item, instancePath } = options
    if (item.provider !== 'mcschematic' || !item.installable) {
      throw new Error('This blueprint provider does not support direct install')
    }

    const task = this.tasks.create<InstallBlueprintTask>({
      type: 'installBlueprint',
      key: `install-blueprint-${item.id}`,
      title: item.title,
      icon: item.icon,
    })

    try {
      const response = await this.app.fetch(mcSchematicDownloadUrl(item.id, item.sourceVersion))
      if (!response.ok) {
        throw new Error(`Failed to download blueprint: ${response.status}`)
      }
      const contentLength = Number(response.headers.get('content-length') || 0)
      if (contentLength > 0) {
        task.progress = { progress: 0, total: contentLength }
      }

      let buffer: Buffer
      const reader = response.body?.getReader()
      if (reader) {
        const chunks: Uint8Array[] = []
        let received = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            received += value.length
            if (contentLength > 0) {
              task.progress = { progress: received, total: contentLength }
            }
          }
        }
        buffer = Buffer.concat(chunks)
      } else {
        buffer = Buffer.from(await response.arrayBuffer())
      }

      const dir = join(instancePath, 'schematics')
      await ensureDir(dir)
      const ext = item.fileType ?? 'schem'
      const name = `${sanitize(item.title) || item.id}.${ext}`
      const dest = join(dir, name)
      await writeFile(dest, buffer)
      task.complete()
      return dest
    } catch (e) {
      task.fail(e)
      throw e
    }
  }
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
    const uploadTime = /<time[^>]*datetime="([^"]+)"/.exec(inner)?.[1]
    // Versions live in `.version .tip_box .t` (Minecraft + mod loader version),
    // feature labels live in `.io .tag`, and the role lives in `.function .c_box`.
    const versionBlock = /<div class="f version">([\s\S]*?)<\/div>\s*<div class="download"/.exec(inner)?.[1] ?? ''
    const allTags = [
      ...matchAll(versionBlock, /class="t"[^>]*>([\s\S]*?)</g),
      ...matchAll(inner, /<span class="[^"]*\btag\b[^"]*">([\s\S]*?)<\/span>/g),
      ...matchAll(inner, /class="c_box[^"]*"[^>]*>([\s\S]*?)<\/span>/g),
    ]
      .map((s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    items.push({
      id,
      provider: 'cms',
      title: name || `#${id}`,
      author,
      description: desc,
      icon: img ? (img.startsWith('http') ? img : `https://www.creativemechanicserver.com${img}`) : undefined,
      size: size?.replaceAll('✖', '×'),
      downloadCount: download ? Number(download.match(/\d+/)?.[0] ?? 0) : undefined,
      tags: allTags.length ? Array.from(new Set(allTags)) : undefined,
      uploadTime,
      pageUrl: `https://www.creativemechanicserver.com/detail/${id}/`,
      installable: false,
    })
  }
  return items
}

/**
 * Parse the minecraft-schematics.com search results page. The site is
 * browse-only (downloads require visiting the website), so items only carry
 * enough metadata to preview and link out.
 */
function parseMinecraftSchematicsHtml(html: string): BlueprintMarketItem[] {
  const items: BlueprintMarketItem[] = []
  const seen = new Set<string>()
  // Each result card is a `<div class="span4">` block.
  for (const block of html.split('<div class="span4">').slice(1)) {
    const id = /href="\/schematic\/(\d+)\//.exec(block)?.[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    const imgTag = /<img[^>]*>/.exec(block)?.[0] ?? ''
    const icon = /src="([^"]+)"/.exec(imgTag)?.[1]
    const alt = /alt="([^"]*)"/.exec(imgTag)?.[1]?.trim()
    const heading = textOf(block, /<h3>\s*<a[^>]*>([\s\S]*?)<\/a>/)
    const fileType = /\bformat_schematic\b/.test(block)
      ? 'schematic'
      : /\bformat_world_save\b/.test(block)
        ? 'world'
        : undefined
    const tags: string[] = []
    if (/\bformat_non_free\b/.test(block)) tags.push('paid')
    items.push({
      id,
      provider: 'minecraft-schematics',
      title: alt || heading || `#${id}`,
      icon,
      fileType,
      tags: tags.length ? tags : undefined,
      pageUrl: `https://www.minecraft-schematics.com/schematic/${id}/`,
      installable: false,
    })
  }
  return items
}

/**
 * Collect the first capture group of every match of a global regex.
 */
function matchAll(html: string, re: RegExp): string[] {
  const result: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    result.push(m[1])
  }
  return result
}

function textOf(html: string, re: RegExp): string | undefined {
  const m = re.exec(html)
  if (!m) return undefined
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || undefined
}
