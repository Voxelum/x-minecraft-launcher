import { ResourceDomain } from '@xmcl/resource'
import {
  convertBlueprint,
  getBlockCount,
  getMaterialList,
  isAir,
  readBlueprint,
  ReplaceMode,
  replaceBlocks,
  writeBlueprint,
  BlueprintFormat,
} from '@xmcl/schematic'
import { FileSystem, openFileSystem } from '@xmcl/system'
import {
  BlueprintConvertOptions,
  BlueprintInfo,
  BlueprintReplaceOptions,
  InstanceBlueprintsService as IInstanceBlueprintsService,
  InstanceBlueprintsServiceKey,
} from '@xmcl/runtime-api'
import { pathExists, readdir, readFile, readJson, writeFile } from 'fs-extra'
import { isAbsolute, join } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, type PathResolver } from '~/app'
import { kResourceManager } from '~/resource'
import { ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'

interface TexContext {
  instancePath?: string
  /** namespace (modid) -> jar path */
  nsJar: Map<string, string>
  /**
   * namespace -> opened jar (null = no jar / failed to open). The value is the
   * in-flight open promise, memoized synchronously so concurrent requests for
   * the same namespace share a single open instead of racing to open (and leak)
   * duplicate handles.
   */
  fs: Map<string, Promise<FileSystem | null>>
  /** memo of resolved block-texture PNGs (null = negative) keyed by block id */
  png: Map<string, Buffer | null>
  /** in-flight/parsed lang files keyed by `${namespace}|${mcLang}` */
  lang: Map<string, Promise<Record<string, string>>>
  /** reset the idle-eviction timer */
  touch: () => void
}

/**
 * Manage blueprint / schematic files of an instance, with conversion, smart
 * block replacement, material list and 3D preview support.
 */
@ExposeServiceKey(InstanceBlueprintsServiceKey)
export class InstanceBlueprintsService extends AbstractInstanceDomainService implements IInstanceBlueprintsService {
  /**
   * Texture lookup cache keyed by instance path (or '__global__'): the resolved
   * `namespace -> jar` map, lazily-opened jars, and memoized block-texture PNGs.
   * Evicted together after an idle timeout so file handles aren't held open.
   */
  private texContexts = new Map<string, Promise<TexContext>>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app, ResourceDomain.Blueprints)

    // Serve block textures over a cacheable URL so the renderer leverages the
    // browser HTTP cache. When an instance is specified, textures are prioritized
    // from that instance's version and mods, falling back to the latest installed
    // vanilla Minecraft client jar.
    app.protocol.registerHandler('http', async ({ request, response }) => {
      if (request.url.host !== 'launcher' || request.url.pathname !== '/block-texture') {
        return
      }
      const block = request.url.searchParams.get('block')
      const instance = request.url.searchParams.get('instance') || undefined
      const face = request.url.searchParams.get('face') || undefined
      if (!block) {
        response.status = 400
        return
      }
      const png = await this.getBlockTexturePng(block, instance, face).catch(() => undefined)
      if (!png) {
        response.status = 404
        return
      }
      response.status = 200
      response.headers['content-type'] = 'image/png'
      response.headers['cache-control'] = 'public, max-age=604800, immutable'
      response.body = png
    })
  }

  private resolveFile(instancePath: string, fileName: string) {
    if (isAbsolute(fileName)) return fileName
    return join(instancePath, this.domain, fileName)
  }

  async getBlueprintInfo(instancePath: string, fileName: string): Promise<BlueprintInfo> {
    const path = this.resolveFile(instancePath, fileName)
    const data = await readFile(path)
    const blueprint = await readBlueprint(data, path)
    const { size, palette, blocks } = blueprint
    const air = palette.map((s) => isAir(s))
    const voxels: number[] = []
    for (let y = 0; y < size.y; y++) {
      for (let z = 0; z < size.z; z++) {
        for (let x = 0; x < size.x; x++) {
          const idx = blocks[x + size.x * (z + size.z * y)]
          if (air[idx]) continue
          voxels.push(x, y, z, idx)
        }
      }
    }
    return {
      format: blueprint.format,
      name: blueprint.name,
      author: blueprint.author,
      description: blueprint.description,
      dataVersion: blueprint.dataVersion,
      size: blueprint.size,
      blockCount: getBlockCount(blueprint),
      materials: getMaterialList(blueprint),
      palette: palette.map((s) => ({ name: s.name, properties: s.properties })),
      voxels,
    }
  }

  /**
   * Resolve a single block's texture PNG, reusing a global cache of the
   * `namespace -> jar` map and opened jars so concurrent per-block requests
   * don't reopen jars. The resolved PNG (or a negative result) is memoized per
   * block id so repeated requests skip all jar I/O entirely.
   */
  /**
   * Resolve a single block's texture PNG, reusing a cache of the
   * `namespace -> jar` map and opened jars so concurrent per-block requests
   * don't reopen jars. The resolved PNG (or a negative result) is memoized per
   * block id so repeated requests skip all jar I/O entirely.
   */
  private async getBlockTexturePng(block: string, instancePath?: string, face?: string): Promise<Buffer | undefined> {
    if (!block || block === 'minecraft:air') return undefined
    const ctx = await this.getTexContext(instancePath)
    ctx.touch()
    const memoKey = face ? `${block}|${face}` : block
    const memo = ctx.png.get(memoKey)
    if (memo !== undefined) return memo ?? undefined

    const png = await this.resolveBlockTexturePng(ctx, block, face)
    ctx.png.set(memoKey, png ?? null)
    return png
  }

  private async resolveBlockTexturePng(ctx: TexContext, block: string, face?: string): Promise<Buffer | undefined> {
    const read = async (namespace: string, assetPath: string): Promise<Buffer | undefined> => {
      const fs = await this.ensureNamespaceFs(ctx, namespace)
      if (!fs) return undefined
      try {
        return Buffer.from(await fs.readFileBuffered(assetPath))
      } catch {
        return undefined
      }
    }

    const [namespace, name] = splitNamespaced(block)

    // Helper to check multiple texture paths in order
    const tryPaths = async (paths: string[]): Promise<Buffer | undefined> => {
      for (const p of paths) {
        const buf = await read(namespace, p)
        if (buf) return buf
      }
      return undefined
    }

    // Specific face handling when requested (e.g. grass top vs side, barrel top vs side, log top vs side)
    if (face === 'top') {
      if (name === 'grass_block') {
        const top = await read(namespace, `assets/${namespace}/textures/block/grass_block_top.png`)
        if (top) return top
      }
      const topBuf = await tryPaths([
        `assets/${namespace}/textures/block/${name}_top.png`,
        `assets/${namespace}/textures/block/${name}_end.png`,
        `assets/${namespace}/textures/block/${name}_up.png`,
      ])
      if (topBuf) return topBuf
    } else if (face === 'bottom') {
      if (name === 'grass_block' || name === 'podzol' || name === 'mycelium' || name === 'dirt_path') {
        const dirt = await read(namespace, `assets/${namespace}/textures/block/dirt.png`)
        if (dirt) return dirt
      }
      const bottomBuf = await tryPaths([
        `assets/${namespace}/textures/block/${name}_bottom.png`,
        `assets/${namespace}/textures/block/${name}_end.png`,
        `assets/${namespace}/textures/block/${name}_down.png`,
      ])
      if (bottomBuf) return bottomBuf
    } else if (face === 'side') {
      const sideBuf = await tryPaths([
        `assets/${namespace}/textures/block/${name}_side.png`,
        `assets/${namespace}/textures/block/${name}.png`,
      ])
      if (sideBuf) return sideBuf
    }

    // 1. Direct block texture lookups
    const direct = await tryPaths([
      `assets/${namespace}/textures/block/${name}.png`,
      `assets/${namespace}/textures/blocks/${name}.png`,
      `assets/${namespace}/textures/block/${name}_side.png`,
      `assets/${namespace}/textures/block/${name}_top.png`,
      `assets/${namespace}/textures/block/${name}_front.png`,
    ])
    if (direct) return direct

    // 2. Common Minecraft block naming variations
    const variantCandidates: string[] = []
    if (name.endsWith('_block')) {
      const b = name.slice(0, -6)
      variantCandidates.push(`assets/${namespace}/textures/block/${b}.png`, `assets/${namespace}/textures/blocks/${b}.png`)
    }
    if (name.endsWith('_stairs')) {
      const base = name.slice(0, -7)
      variantCandidates.push(
        `assets/${namespace}/textures/block/${base}.png`,
        `assets/${namespace}/textures/block/${base}_planks.png`,
        `assets/${namespace}/textures/block/${base}_bricks.png`,
      )
    }
    if (name.endsWith('_slab')) {
      const base = name.slice(0, -5)
      variantCandidates.push(
        `assets/${namespace}/textures/block/${base}.png`,
        `assets/${namespace}/textures/block/${base}_side.png`,
        `assets/${namespace}/textures/block/${name}_side.png`,
        `assets/${namespace}/textures/block/${base}_planks.png`,
        `assets/${namespace}/textures/block/${base}_bricks.png`,
      )
    }
    if (name.endsWith('_wall')) {
      const base = name.slice(0, -5)
      variantCandidates.push(
        `assets/${namespace}/textures/block/${base}.png`,
        `assets/${namespace}/textures/block/${base}_bricks.png`,
      )
    }
    if (name.endsWith('_fence_gate') || name.endsWith('_fence')) {
      const base = name.replace(/_fence(_gate)?$/, '')
      variantCandidates.push(
        `assets/${namespace}/textures/block/${base}_planks.png`,
        `assets/${namespace}/textures/block/${base}.png`,
      )
    }
    if (name.endsWith('_carpet')) {
      const base = name.replace(/_carpet$/, '')
      variantCandidates.push(`assets/${namespace}/textures/block/${base}_wool.png`)
    }
    if (name.endsWith('_pane')) {
      const base = name.replace(/_pane$/, '')
      variantCandidates.push(`assets/${namespace}/textures/block/${base}.png`)
    }
    if (name.endsWith('_pressure_plate') || name.endsWith('_button')) {
      const base = name.replace(/(_pressure_plate|_button)$/, '')
      variantCandidates.push(
        `assets/${namespace}/textures/block/${base}.png`,
        `assets/${namespace}/textures/block/${base}_planks.png`,
      )
    }
    if (name.endsWith('_door')) {
      variantCandidates.push(
        `assets/${namespace}/textures/block/${name}_top.png`,
        `assets/${namespace}/textures/block/${name}_bottom.png`,
      )
    }
    if (variantCandidates.length > 0) {
      const variantBuf = await tryPaths(variantCandidates)
      if (variantBuf) return variantBuf
    }

    // 3. Model JSON lookup with parent inheritance and merged texture definitions
    const modelBytes = await read(namespace, `assets/${namespace}/models/block/${name}.json`)
    if (modelBytes) {
      try {
        let model = JSON.parse(modelBytes.toString('utf-8'))
        let mergedTextures: Record<string, string> = { ...(model.textures ?? {}) }
        let depth = 0
        let currentModel = model
        while (currentModel.parent && depth < 3) {
          depth++
          const [parentNs, parentPath] = splitNamespaced(currentModel.parent)
          const normParent = parentPath.startsWith('block/') ? parentPath : `block/${parentPath}`
          const parentBytes = await read(parentNs, `assets/${parentNs}/models/${normParent}.json`)
          if (!parentBytes) break
          currentModel = JSON.parse(parentBytes.toString('utf-8'))
          mergedTextures = { ...(currentModel.textures ?? {}), ...mergedTextures }
        }

        let ref: string | undefined
        if (face === 'top') {
          ref = mergedTextures.top || mergedTextures.up || mergedTextures.end
        } else if (face === 'bottom') {
          ref = mergedTextures.bottom || mergedTextures.down || mergedTextures.end
        } else if (face === 'side') {
          ref = mergedTextures.side || mergedTextures.north || mergedTextures.front
        }
        if (!ref) {
          ref = pickTextureRef(mergedTextures)
        }

        if (ref) {
          const [texNs, texPath] = splitNamespaced(ref)
          const cleanTexPath = texPath.replace(/^textures\//, '')
          const png = (await read(texNs, `assets/${texNs}/textures/${cleanTexPath}.png`))
            || (await read(texNs, `assets/${texNs}/textures/block/${cleanTexPath}.png`))
            || (await read(texNs, `assets/${texNs}/textures/blocks/${cleanTexPath}.png`))
          if (png) return png
        }
      } catch {
        // ignore malformed model
      }
    }

    // 4. Last resort item texture fallback
    return await read(namespace, `assets/${namespace}/textures/item/${name}.png`)
  }

  async getBlockNames(blocks: string[], locale: string, instancePath?: string): Promise<Record<string, string>> {
    const mcLang = toMcLang(locale)
    const result: Record<string, string> = {}
    const ctx = await this.getTexContext(instancePath)
    ctx.touch()

    const namespaces = new Set(blocks.map((b) => splitNamespaced(b)[0]))
    const langByNs = new Map<string, Record<string, string>>()
    await Promise.all([...namespaces].map(async (ns) => { langByNs.set(ns, await this.getLang(ctx, ns, mcLang)) }))

    for (const block of blocks) {
      const [namespace, name] = splitNamespaced(block)
      const lang = langByNs.get(namespace)
      const translated = lang?.[`block.${namespace}.${name}`]
      if (translated) result[block] = translated
    }
    return result
  }

  /**
   * Load and cache a namespace's lang file (en_us merged with the requested
   * locale, locale taking precedence).
   *
   * For the vanilla `minecraft` namespace only `en_us.json` ships inside the
   * client jar — every other language lives in the shared assets-objects store
   * referenced by the asset index — so non-English vanilla translations are read
   * from there.
   */
  private getLang(ctx: TexContext, namespace: string, mcLang: string): Promise<Record<string, string>> {
    const cacheKey = `${namespace}|${mcLang}`
    let pending = ctx.lang.get(cacheKey)
    if (pending) return pending
    pending = (async () => {
      const lang: Record<string, string> = {}
      const fs = await this.ensureNamespaceFs(ctx, namespace)

      // Base: en_us from the jar.
      await assignJarLang(fs, namespace, 'en_us', lang)

      if (mcLang !== 'en_us') {
        // The locale file may be in the jar (mods bundle theirs; resource packs).
        await assignJarLang(fs, namespace, mcLang, lang)
        // Vanilla locales live in the shared assets store, not the jar.
        if (namespace === 'minecraft') {
          const fromAssets = await this.getVanillaLangFromAssets(mcLang).catch(() => undefined)
          if (fromAssets) Object.assign(lang, fromAssets)
        }
      }

      return lang
    })()
    ctx.lang.set(cacheKey, pending)
    return pending
  }

  /**
   * Read a vanilla lang file (e.g. `zh_cn`) from the shared assets-objects store
   * via the newest asset index.
   */
  private async getVanillaLangFromAssets(mcLang: string): Promise<Record<string, string> | undefined> {
    const root = this.getPath()
    const indexesDir = join(root, 'assets', 'indexes')
    const indexFiles = (await readdir(indexesDir).catch(() => [] as string[]))
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    const langKey = `minecraft/lang/${mcLang}.json`
    for (const file of indexFiles) {
      const index = await readJson(join(indexesDir, file)).catch(() => undefined)
      const hash = index?.objects?.[langKey]?.hash
      if (typeof hash === 'string' && hash.length >= 2) {
        const objPath = join(root, 'assets', 'objects', hash.slice(0, 2), hash)
        const data = await readJson(objPath).catch(() => undefined)
        if (data && typeof data === 'object') return data as Record<string, string>
      }
    }
    return undefined
  }

  private getTexContext(instancePath?: string): Promise<TexContext> {
    const key = instancePath || '__global__'
    let existing = this.texContexts.get(key)
    if (existing) return existing

    existing = (async () => {
      const nsJar = await this.buildNamespaceJarMap(instancePath).catch(() => new Map<string, string>())
      const fs = new Map<string, Promise<FileSystem | null>>()
      let timer: ReturnType<typeof setTimeout>
      const dispose = () => {
        this.log(`Evicting idle texture jar handles for ${key}`)
        this.texContexts.delete(key)
        for (const pending of fs.values()) {
          pending.then((f) => { try { f?.close() } catch { /* ignore */ } }).catch(() => { /* ignore */ })
        }
      }
      const touch = () => {
        this.log(`Touching texture jar handles for ${key}`)
        clearTimeout(timer)
        timer = setTimeout(dispose, 60_000)
      }
      const ctx: TexContext = { instancePath, nsJar, fs, png: new Map(), lang: new Map(), touch }
      touch()
      return ctx
    })()
    this.texContexts.set(key, existing)
    return existing
  }

  private ensureNamespaceFs(ctx: TexContext, namespace: string): Promise<FileSystem | undefined> {
    let pending = ctx.fs.get(namespace)
    if (!pending) {
      pending = (async (): Promise<FileSystem | null> => {
        if (namespace === 'minecraft') {
          return (await this.resolveVanillaFs(ctx.instancePath)) ?? null
        }
        const jar = ctx.nsJar.get(namespace)
        if (!jar) return null
        return (await openFileSystem(jar).catch(() => undefined)) ?? null
      })()
      ctx.fs.set(namespace, pending)
    }
    return pending.then((fs) => fs ?? undefined)
  }

  /**
   * Open an installed Minecraft client jar that actually contains vanilla block
   * textures. If an instancePath is provided, first checks that instance's
   * configured Minecraft version jar. Otherwise, scans installed versions and
   * selects the newest vanilla version (e.g. 1.21.x > 1.20.x).
   */
  private async resolveVanillaFs(instancePath?: string): Promise<FileSystem | undefined> {
    const versionsDir = join(this.getPath(), 'versions')

    // 1. If an instance is specified, try its configured Minecraft version first
    if (instancePath) {
      try {
        const config = await readJson(join(instancePath, 'instance.json')).catch(() => undefined)
        const candidates = [
          config?.runtime?.minecraft,
          config?.version,
        ].filter((c): c is string => typeof c === 'string' && !!c)

        for (const ver of candidates) {
          const jar = join(versionsDir, ver, `${ver}.jar`)
          if (await pathExists(jar)) {
            const fs = await openFileSystem(jar).catch(() => undefined)
            if (fs) {
              try {
                await fs.readFile('assets/minecraft/textures/block/stone.png')
                return fs
              } catch {
                try { fs.close() } catch { /* ignore */ }
              }
            }
          }
        }
      } catch {
        // ignore instance reading errors
      }
    }

    // 2. Scan installed versions.
    // Real vanilla releases start with 1. (e.g. 1.21.1, 1.20.4, 1.12.2).
    // Sorting with numeric: true ensures newest releases come first.
    const dirs = await readdir(versionsDir).catch(() => [] as string[])
    const isVanilla = (d: string) => /^1\.\d+(\.\d+)*$/.test(d)
    const sorted = [...dirs].sort((a, b) => {
      const av = isVanilla(a)
      const bv = isVanilla(b)
      if (av !== bv) return av ? -1 : 1
      return b.localeCompare(a, undefined, { numeric: true })
    })

    for (const dir of sorted) {
      const jar = join(versionsDir, dir, `${dir}.jar`)
      if (!await pathExists(jar)) continue
      const fs = await openFileSystem(jar).catch(() => undefined)
      if (!fs) continue
      try {
        await fs.readFile('assets/minecraft/textures/block/stone.png')
        return fs
      } catch {
        // missing sentinel or broken jar
      }
      try { fs.close() } catch { /* ignore */ }
    }
    return undefined
  }

  /**
   * Build a `namespace -> jar path` map from the instance's local mods and the
   * cached mod metadata of every known mod, so namespaces resolve directly.
   */
  private async buildNamespaceJarMap(instancePath?: string): Promise<Map<string, string>> {
    const map = new Map<string, string>()

    // 1. If an instance has local mods in <instance>/mods, register them
    if (instancePath) {
      const modsDir = join(instancePath, 'mods')
      const files = await readdir(modsDir).catch(() => [] as string[])
      for (const file of files) {
        if (!file.endsWith('.jar')) continue
        const jarPath = join(modsDir, file)
        const base = file.replace(/\.jar$/, '').toLowerCase()
        const simpleName = base.split(/[-_+]/)[0]
        if (simpleName && !map.has(simpleName)) {
          map.set(simpleName, jarPath)
        }
      }
    }

    // 2. Query resource manager database
    const resourceManager = await this.app.registry.getOrCreate(kResourceManager)
    if (!resourceManager?.context) return map
    const root = resourceManager.context.root
    const rows = await resourceManager.context.db
      .selectFrom('snapshots')
      .innerJoin('resources', 'snapshots.sha1', 'resources.sha1')
      .select([
        'snapshots.domainedPath as domainedPath',
        'resources.forge as forge',
        'resources.fabric as fabric',
        'resources.neoforge as neoforge',
        'resources.quilt as quilt',
        'resources.liteloader as liteloader',
      ])
      .where('snapshots.domainedPath', 'like', '%mods/%')
      .execute()
      .catch(() => [] as any[])
    for (const row of rows as any[]) {
      const domainedPath = row.domainedPath as string
      if (!domainedPath || !domainedPath.endsWith('.jar')) continue
      const jar = join(root, domainedPath)
      for (const id of modIdsOf(row)) {
        if (id && !map.has(id)) map.set(id, jar)
      }
    }
    return map
  }

  async convertBlueprint(options: BlueprintConvertOptions): Promise<string> {
    const path = this.resolveFile(options.instancePath, options.fileName)
    const data = await readFile(path)
    const { data: out, extension } = await convertBlueprint(data, path, options.target as BlueprintFormat)
    const dir = join(options.instancePath, this.domain)
    const baseName = (options.output ?? stripExtension(basename(path))) + extension
    const dest = join(dir, baseName)
    await writeFile(dest, Buffer.from(out))
    return dest
  }

  async replaceBlueprintBlocks(options: BlueprintReplaceOptions): Promise<string> {
    const path = this.resolveFile(options.instancePath, options.fileName)
    const data = await readFile(path)
    const blueprint = await readBlueprint(data, path)
    replaceBlocks(
      blueprint,
      options.replacements,
      options.mode === 'precise' ? ReplaceMode.Precise : ReplaceMode.Simple,
    )
    const out = await writeBlueprint(blueprint, blueprint.format)
    const dest = options.output
      ? join(options.instancePath, this.domain, options.output)
      : path
    await writeFile(dest, Buffer.from(out))
    return dest
  }
}

/**
 * Merge a namespace's lang file from an opened jar into `target`. Missing or
 * malformed files are ignored.
 */
async function assignJarLang(
  fs: FileSystem | undefined,
  namespace: string,
  code: string,
  target: Record<string, string>,
): Promise<void> {
  if (!fs) return
  try {
    Object.assign(target, JSON.parse(Buffer.from(await fs.readFileBuffered(`assets/${namespace}/lang/${code}.json`)).toString('utf-8')))
  } catch {
    // missing or malformed lang
  }
}

function basename(p: string) {
  const norm = p.replace(/\\/g, '/')
  return norm.slice(norm.lastIndexOf('/') + 1)
}

function stripExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

/**
 * Map an app/vue-i18n locale (e.g. `zh-CN`, `en`) to a Minecraft lang code
 * (e.g. `zh_cn`, `en_us`).
 */
function toMcLang(locale: string): string {
  const lower = (locale || 'en').toLowerCase().replace('-', '_')
  if (lower.includes('_')) return lower
  const defaults: Record<string, string> = {
    en: 'en_us', zh: 'zh_cn', ru: 'ru_ru', ja: 'ja_jp', ko: 'ko_kr', fr: 'fr_fr',
    de: 'de_de', es: 'es_es', pt: 'pt_br', it: 'it_it', uk: 'uk_ua', pl: 'pl_pl',
    nl: 'nl_nl', tr: 'tr_tr', cs: 'cs_cz', vi: 'vi_vn', th: 'th_th', gl: 'gl_es',
    kz: 'kk_kz', lolcat: 'lol_us',
  }
  return defaults[lower] ?? `${lower}_${lower}`
}

/**
 * Split a namespaced id like `mcwroofs:deepslate_roof` or
 * `minecraft:block/deepslate` into `[namespace, path]`. Defaults the namespace
 * to `minecraft` when absent.
 */
function splitNamespaced(id: string): [string, string] {
  const colon = id.indexOf(':')
  if (colon === -1) return ['minecraft', id]
  return [id.slice(0, colon), id.slice(colon + 1)]
}

/**
 * Pick a representative texture reference from a model's `textures` map,
 * resolving `#variable` indirections. Returns a concrete reference (possibly
 * namespaced) or `undefined`.
 */
function pickTextureRef(textures: Record<string, string>): string | undefined {
  const order = ['all', 'top', 'side', 'end', 'front', 'texture', 'particle', 'cross', 'rail', 'wall', 'pane']
  const keys = [...order.filter((k) => k in textures), ...Object.keys(textures)]
  for (const key of keys) {
    let value = textures[key]
    let guard = 0
    while (typeof value === 'string' && value.startsWith('#') && guard++ < 8) {
      value = textures[value.slice(1)]
    }
    if (typeof value === 'string' && value && !value.startsWith('#')) {
      return value
    }
  }
  return undefined
}

/**
 * Collect the mod ids declared by a resource's metadata. The asset namespace
 * equals the modid for the vast majority of mods.
 */
function modIdsOf(meta: any): string[] {
  const ids: string[] = []
  if (meta.forge?.modid) ids.push(meta.forge.modid)
  if (meta.neoforge?.modid) ids.push(meta.neoforge.modid)
  const fabric = meta.fabric
  if (Array.isArray(fabric)) {
    for (const f of fabric) if (f?.id) ids.push(f.id)
  } else if (fabric?.id) {
    ids.push(fabric.id)
  }
  if (meta.quilt?.id) ids.push(meta.quilt.id)
  if (meta.liteloader?.name) ids.push(meta.liteloader.name)
  return ids
}
