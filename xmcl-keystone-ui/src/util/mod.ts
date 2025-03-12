import { FabricModMetadata, ForgeModMetadata, ForgeModTOMLData, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import { ForgeModCommonMetadata, NeoforgeMetadata, Resource, ResourceSourceCurseforge, ResourceSourceModrinth, RuntimeVersions } from '@xmcl/runtime-api'
import { ModDependencies, getModDependencies, getModProvides } from './modDependencies'
import { ProjectFile } from './search'
import { notNullish } from '@vueuse/core'

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
   * The mod id
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
  dependencies: ModDependencies
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
    dependencies: runtime.fabricLoader
      ? (getModDependencies(resource, 'fabric').map(markRaw))
      : runtime.neoForged
        ? (getModDependencies(resource, 'neoforge').map(markRaw))
        : (getModDependencies(resource, 'forge').map(markRaw)),
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
  })
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
    modItem.authors = meta.authors?.map(a => typeof a === 'string' ? a : a.name) ?? []
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
