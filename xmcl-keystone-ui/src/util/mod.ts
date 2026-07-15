import { notNullish } from '@vueuse/core'
import { RuntimeVersions } from '@xmcl/instance'
import { FabricModMetadata, ForgeModMetadata, ForgeModTOMLData, QuiltModMetadata } from '@xmcl/mod-parser'
import { Resource, ResourceSourceCurseforge, ResourceSourceModrinth } from '@xmcl/resource'
import { ForgeModCommonMetadata, NeoforgeMetadata } from '@xmcl/runtime-api'
import { ModDependencies, getModDependencies, getModProvides } from './modDependencies'
import { ProjectFile } from './search'

interface ModMetadata {
  /**
   * The extenral links
   */
  links: {
    home?: string
    issues?: string
    sources?: string
    update?: string
    irc?: string
    [key: string]: string | undefined
  }
  /**
   * The license
   */
  license?: { url?: string; name: string }
}
/**
 * Contain the mod related data. Extracted from {@link Resource}
 */
export interface ModFile extends ModMetadata, ProjectFile {
  /**
   * Path on disk
   */
  path: string
  /**
   * The mod id. This is computed from the metadata.
   */
  modId: string
  /**
   * Mod display name
   */
  name: string
  /**
   * The file name
   */
  fileName: string
  /**
   * Mod version
   */
  version: string
  /**
   * The authors
   */
  authors: string[]
  /**
   * The mod description text
   */
  description: string
  /**
   * Mod icon url
   */
  icon: string
  /**
   * Supported mod loaders
   */
  modLoaders: string[]
  /**
   * The resource tag
   */
  tags: string[]
  /**
   * The hash of the resource
   */
  hash: string
  /**
   * The universal location of the mod
   */
  url: string
  /**
   * All mod dependencies
   */
  dependencies: {
    [runtime: string]: ModDependencies
  }
  /**
   * The provided runtime
   */
  provideRuntime: Record<string, string>
  /**
   * If this mod is enabled. This is computed from the path suffix.
   */
  enabled: boolean
  /**
   * Curseforge metadata
   */
  curseforge?: ResourceSourceCurseforge
  /**
   * Modrinth metadata
   */
  modrinth?: ResourceSourceModrinth
  forge?: ForgeModCommonMetadata
  fabric?: FabricModMetadata | FabricModMetadata[]
  quilt?: QuiltModMetadata
  neoforge?: NeoforgeMetadata

  ino: number
  size: number
  mtime: number
}

function getUrl(resource: Resource) {
  return ''
  // return resource.uris.find(u => u?.startsWith('http')) ?? ''
}

function getLinksFromTOML(links: ModFile['links'], m: ForgeModTOMLData) {
  if (m.issueTrackerURL) {
    links.issues = m.issueTrackerURL
  }
  if (m.updateJSONURL) {
    links.update = m.updateJSONURL
  }
  if (m.displayURL) {
    links.home = m.displayURL
  }
}

function getForgeModLinks(metadata: ForgeModMetadata) {
  const links: ModFile['links'] = {}
  if (metadata.modsToml && metadata.modsToml.length > 0) {
    for (const m of metadata.modsToml) {
      getLinksFromTOML(links, m)
    }
  } else if (metadata.mcmodInfo && metadata.mcmodInfo.length > 0) {
    for (const m of metadata.mcmodInfo) {
      if (m.updateUrl) {
        links.update = m.updateUrl
      }
      if (m.url) {
        links.home = m.url
      }
    }
  } else if (metadata.manifestMetadata) {
    links.home = metadata.manifestMetadata.url
  }
  return links
}

function getFabricLikeModLinks(contact?: FabricModMetadata['contact'] & { sources?: string | string[] }) {
  const links: ModFile['links'] = {}
  if (contact) {
    if (contact.issues) {
      links.issues = contact.issues
    }
    if (contact.homepage) {
      links.home = contact.homepage
    }
    if (contact.sources) {
      if (typeof contact.sources === 'string') {
        links.sources = contact.sources
      } else {
        links.sources = contact.sources[0]
        // links.push(...contact.sources.map(s => ({ url: s, name: 'Source' })))
      }
    }
    if (contact.irc) {
      links.irc = contact.irc
    }
    if (contact.email) {
      links.email = contact.email
    }
  }
  return links
}

export function getModSide(mod: ModFile, runtime: 'fabric' | 'forge' | 'neoforge' | 'quilt') {
  const fabric = mod.fabric
  if (fabric && runtime) {
    let env: 'client' | 'server' | '*' | undefined
    if (fabric instanceof Array) {
      env = fabric[0].environment
    } else {
      env = fabric.environment
    }
    if (env === '*') {
      return 'BOTH'
    }
    if (env === 'client') {
      return 'CLIENT'
    }
    if (env === 'server') {
      return 'SERVER'
    }
  }
  if (mod.quilt && runtime === 'quilt') {
    const quilt = mod.quilt
    if (quilt.quilt_loader.minecraft?.environment === '*') {
      return 'BOTH'
    }
    if (quilt.quilt_loader.minecraft?.environment === 'client') {
      return 'CLIENT'
    }
    if (quilt.quilt_loader.minecraft?.environment === 'dedicated_server') {
      return 'SERVER'
    }
  }
  if (mod.forge && runtime === 'forge') {
    const forge = mod.forge
    const tomls = forge.modsToml
    const sides = new Set(tomls.reduce((acc, toml) => {
      return [...acc, ...toml.dependencies.map(d => d.side).filter(notNullish)]
    }, [] as Array<"BOTH" | "CLIENT" | "SERVER">))
    if (sides.has('BOTH') || (sides.has('CLIENT') && sides.has('SERVER'))) {
      return 'BOTH'
    }
    if (sides.has('CLIENT')) {
      return 'CLIENT'
    }
    if (sides.has('SERVER')) {
      return 'SERVER'
    }
  }
  if (mod.neoforge && runtime === 'neoforge' && mod.neoforge.dependencies instanceof Array) {
    const sides = new Set(mod.neoforge.dependencies.map(d => d.side).filter(notNullish))
    if (sides.has('BOTH') || (sides.has('CLIENT') && sides.has('SERVER'))) {
      return 'BOTH'
    }
    if (sides.has('CLIENT')) {
      return 'CLIENT'
    }
    if (sides.has('SERVER')) {
      return 'SERVER'
    }
  }

  return ''
}

export function isModFile(file: ProjectFile): file is ModFile {
  return (file as ModFile).dependencies !== undefined
}

export function getModMinecraftVersion(mod: ModFile) {
  for (const deps of Object.values(mod.dependencies)) {
    for (const dep of deps) {
      if (dep.modId === 'minecraft') {
        const mcDep = dep
        const mcVer = (mcDep?.semanticVersion instanceof Array ? mcDep.semanticVersion.join(' ') : mcDep?.semanticVersion) ?? mcDep?.versionRange
        if (mcVer) {
          return mcVer
        }
      }
    }
  }
}

/**
 * Get the required (non-optional) dependency mod ids of a mod across all runtimes.
 */
export function getRequiredModDependencyIds(mod: ModFile): string[] {
  const result = new Set<string>()
  for (const deps of Object.values(mod.dependencies)) {
    for (const dep of deps) {
      if (dep.optional) continue
      result.add(dep.modId)
    }
  }
  return [...result]
}

/**
 * Build an index mapping a provided mod id to the mods that provide it.
 */
function buildModProviderIndex(mods: ModFile[]) {
  const providers = new Map<string, ModFile[]>()
  for (const mod of mods) {
    for (const id of Object.keys(mod.provideRuntime)) {
      const arr = providers.get(id)
      if (arr) arr.push(mod)
      else providers.set(id, [mod])
    }
  }
  return providers
}

/**
 * Resolve the full set of mods that should be disabled together with the given mods.
 *
 * When a mod is disabled, its dependency mods are disabled as well, but only if they
 * are no longer required by any other mod that stays enabled. Dependencies are matched
 * by mod id via each mod's provided runtime.
 */
export function resolveModsToDisable(toDisable: ModFile[], allMods: ModFile[]): ModFile[] {
  const providers = buildModProviderIndex(allMods)
  const disabled = new Set(toDisable)
  const queue = [...toDisable]

  const isStillNeeded = (dep: ModFile) => {
    const providedIds = Object.keys(dep.provideRuntime)
    if (providedIds.length === 0) return false
    const providedSet = new Set(providedIds)
    for (const mod of allMods) {
      if (mod === dep || disabled.has(mod) || !mod.enabled) continue
      for (const depId of getRequiredModDependencyIds(mod)) {
        if (providedSet.has(depId)) return true
      }
    }
    return false
  }

  while (queue.length) {
    const mod = queue.pop()!
    for (const depId of getRequiredModDependencyIds(mod)) {
      const provs = providers.get(depId)
      if (!provs) continue
      for (const dep of provs) {
        if (disabled.has(dep) || !dep.enabled) continue
        if (isStillNeeded(dep)) continue
        disabled.add(dep)
        queue.push(dep)
      }
    }
  }

  return [...disabled]
}

/**
 * Resolve the full set of mods that should be enabled together with the given mods.
 *
 * When a mod is enabled, its dependency mods are enabled as well, if they exist and are
 * not already enabled. Dependencies are matched by mod id via each mod's provided runtime.
 */
export function resolveModsToEnable(toEnable: ModFile[], allMods: ModFile[]): ModFile[] {
  const providers = buildModProviderIndex(allMods)
  const enabled = new Set(toEnable)
  const queue = [...toEnable]

  while (queue.length) {
    const mod = queue.pop()!
    for (const depId of getRequiredModDependencyIds(mod)) {
      const provs = providers.get(depId)
      if (!provs) continue
      // Already satisfied by a provider that is (or will be) enabled
      if (provs.some(p => p.enabled || enabled.has(p))) continue
      for (const dep of provs) {
        if (enabled.has(dep)) continue
        enabled.add(dep)
        queue.push(dep)
      }
    }
  }

  return [...enabled]
}

export function getModFileFromResource(resource: Resource, runtime: RuntimeVersions): ModFile {
  const modItem: ModFile = markRaw({
    path: resource.path,
    modId: '',
    name: resource.fileName,
    version: '',
    modLoaders: markRaw([]),
    description: '',
    authors: [],
    links: {},
    provideRuntime: markRaw(getModProvides(resource)),
    icon: resource.icons?.at(-1) ?? '',
    dependencies: getModDependencies(resource),
    url: '',
    hash: resource.hash,
    tags: [],
    enabled: !resource.path.endsWith('.disabled'),
    curseforge: resource.metadata.curseforge && markRaw(resource.metadata.curseforge),
    modrinth: resource.metadata.modrinth && markRaw(resource.metadata.modrinth),

    fabric: resource.metadata.fabric,
    forge: resource.metadata.forge,
    quilt: resource.metadata.quilt,
    neoforge: resource.metadata.neoforge,

    ino: resource.ino,
    size: resource.size,
    mtime: resource.mtime,
    fileName: resource.fileName,
  } as ModFile)
  if (resource.metadata.forge) {
    modItem.modLoaders.push('forge')
  }
  if (resource.metadata.fabric) {
    modItem.modLoaders.push('fabric')
  }
  if (resource.metadata.liteloader) {
    modItem.modLoaders.push('liteloader')
  }
  if (resource.metadata.quilt) {
    modItem.modLoaders.push('quilt')
  }
  if (resource.metadata.neoforge) {
    modItem.modLoaders.push('neoforge')
  }
  const applyNeoforge = () => {
    const meta = resource.metadata.neoforge
    if (!meta) return true
    modItem.modId = meta.modid
    modItem.name = meta.displayName
    modItem.version = meta.version
    modItem.description = meta.description
    modItem.authors = typeof meta.authors === 'string' ? [meta.authors] : meta.authors ?? []
    modItem.links = {}
    getLinksFromTOML(modItem.links, meta)
  }
  const applyForge = () => {
    const meta = resource.metadata.forge
    if (!meta) return true
    modItem.modId = meta.modid
    modItem.name = meta.name
    modItem.version = meta.version
    modItem.description = meta.description
    modItem.authors = meta.authors
    modItem.links = getForgeModLinks(meta)
  }
  const applyFabric = () => {
    const meta = resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric
    if (!meta) return true
    modItem.modId = meta.id
    modItem.version = meta.version
    modItem.name = meta.name ?? meta.id
    modItem.description = meta.description ?? ''
    // Fabric mods in the wild sometimes serialise `authors` as a single
    // string instead of the spec-mandated array, which crashed the UI
    // with `TypeError: se.authors?.map is not a function` (telemetry,
    // 0.56.4). Normalise both shapes before mapping.
    const fabricAuthorsRaw: any = meta.authors
    const fabricAuthors: any[] = Array.isArray(fabricAuthorsRaw)
      ? fabricAuthorsRaw
      : typeof fabricAuthorsRaw === 'string'
        ? [fabricAuthorsRaw]
        : []
    modItem.authors = fabricAuthors.map(a => typeof a === 'string' ? a : a.name)
    modItem.links = getFabricLikeModLinks(meta.contact)
    modItem.license = typeof meta.license === 'string' ? { name: meta.license } : meta.license ? { name: meta.license?.[0] } : undefined
  }
  const applyQuilt = () => {
    const meta = resource.metadata.quilt
    if (!meta) return true
    modItem.modId = meta.quilt_loader.id
    modItem.version = meta.quilt_loader.version
    modItem.name = meta.quilt_loader.metadata?.name ?? meta.quilt_loader.id
    modItem.description = meta.quilt_loader.metadata?.description ?? ''
    modItem.authors = meta.quilt_loader.metadata?.contributors ? Object.values(meta.quilt_loader.metadata?.contributors) : []
    modItem.links = getFabricLikeModLinks(meta.quilt_loader.metadata?.contact as any)
    const license = meta.quilt_loader.metadata?.license
    modItem.license = typeof license === 'object'
      ? license instanceof Array ? { name: license[0] } : { name: license.id, url: license.url }
      : license ? { name: license } : undefined
  }
  const applyLiteloader = () => {
    const meta = resource.metadata.liteloader
    if (!meta) return true
    modItem.name = meta.name
    modItem.version = meta.version ?? ''
    modItem.modId = `${meta.name}`
    modItem.description = modItem.description ?? ''
    modItem.authors = meta.author ? [meta.author] : []
    if (meta.url) {
      modItem.links = { home: meta.url }
    }
  }
  const order = runtime.fabricLoader
    ? [applyFabric, applyQuilt, applyForge, applyNeoforge, applyLiteloader]
    : runtime.quiltLoader
      ? [applyQuilt, applyFabric, applyForge, applyNeoforge, applyLiteloader]
      : runtime.forge
        ? [applyForge, applyNeoforge, applyFabric, applyQuilt, applyLiteloader]
        : runtime.neoForged
          ? [applyNeoforge, applyForge, applyFabric, applyQuilt, applyLiteloader]
          : [applyForge, applyFabric, applyQuilt, applyNeoforge, applyLiteloader]

  for (const apply of order) {
    if (!apply()) {
      break
    }
  }

  if (!modItem.name) {
    modItem.name = resource.fileName
  }
  if (!modItem.modId) {
    modItem.modId = resource.fileName + resource.hash.slice(0, 4)
  }
  if (!modItem.version) {
    modItem.version = '?'
  }
  if (!modItem.name) {
    modItem.name = resource.fileName
  }
  return markRaw(modItem)
}
