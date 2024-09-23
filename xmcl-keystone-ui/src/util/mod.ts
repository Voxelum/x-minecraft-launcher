import { FabricModMetadata, ForgeModMetadata, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import { ForgeModCommonMetadata, Resource, ResourceSourceCurseforge, ResourceSourceModrinth, RuntimeVersions } from '@xmcl/runtime-api'
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
   * The mod id
   */
  modId: string
  /**
   * Mod display name
   */
  name: string
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

  curseforge?: ResourceSourceCurseforge
  modrinth?: ResourceSourceModrinth
  /**
   * The backed resource
   */
  resource: Resource
}

function getUrl(resource: Resource) {
  return resource.uris.find(u => u?.startsWith('http')) ?? ''
}

function getForgeModLinks(metadata: ForgeModMetadata) {
  const links: ModFile['links'] = {}
  if (metadata.modsToml && metadata.modsToml.length > 0) {
    for (const m of metadata.modsToml) {
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

export function getModFileFromResource(resource: Resource, runtime: RuntimeVersions): ModFile {
  const modItem: ModFile = ({
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
      ? (getModDependencies(resource, true).map(markRaw))
      : (getModDependencies(resource, false).map(markRaw)),
    url: getUrl(resource),
    hash: resource.hash,
    tags: resource.tags,
    enabled: !resource.path.endsWith('.disabled'),
    curseforge: resource.metadata.curseforge && markRaw(resource.metadata.curseforge),
    modrinth: resource.metadata.modrinth && markRaw(resource.metadata.modrinth),
    resource: markRaw(resource),
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
  const applyForge = (meta: ForgeModCommonMetadata) => {
    modItem.modId = meta.modid
    modItem.name = meta.name
    modItem.version = meta.version
    modItem.description = meta.description
    modItem.authors = meta.authors
    modItem.links = getForgeModLinks(meta)
  }
  const applyFabric = (meta: FabricModMetadata) => {
    modItem.modId = meta.id
    modItem.version = meta.version
    modItem.name = meta.name ?? meta.id
    modItem.description = meta.description ?? ''
    modItem.authors = meta.authors?.map(a => typeof a === 'string' ? a : a.name) ?? []
    modItem.links = getFabricLikeModLinks(meta.contact)
    modItem.license = typeof meta.license === 'string' ? { name: meta.license } : meta.license ? { name: meta.license?.[0] } : undefined
  }
  const applyQuilt = (meta: QuiltModMetadata) => {
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
  const applyLiteloader = (meta: LiteloaderModMetadata) => {
    modItem.name = meta.name
    modItem.version = meta.version ?? ''
    modItem.modId = `${meta.name}`
    modItem.description = modItem.description ?? ''
    modItem.authors = meta.author ? [meta.author] : []
    if (meta.url) {
      modItem.links = { home: meta.url }
    }
  }
  if (runtime.fabricLoader) {
    if (resource.metadata.fabric) applyFabric(resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric)
    else if (resource.metadata.quilt) applyQuilt(resource.metadata.quilt)
    else if (resource.metadata.forge) applyForge(resource.metadata.forge)
    else if (resource.metadata.liteloader) applyLiteloader(resource.metadata.liteloader)
  } else if (runtime.quiltLoader) {
    if (resource.metadata.quilt) applyQuilt(resource.metadata.quilt)
    else if (resource.metadata.fabric) applyFabric(resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric)
    else if (resource.metadata.forge) applyForge(resource.metadata.forge)
    else if (resource.metadata.liteloader) applyLiteloader(resource.metadata.liteloader)
  } else {
    if (resource.metadata.forge) applyForge(resource.metadata.forge)
    else if (resource.metadata.fabric) applyFabric(resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric)
    else if (resource.metadata.liteloader) applyLiteloader(resource.metadata.liteloader)
    else if (resource.metadata.quilt) applyQuilt(resource.metadata.quilt)
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
