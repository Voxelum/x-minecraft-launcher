import { Resource } from '@xmcl/runtime-api'
import { ModDependencies, getModDependencies, getModProvides } from './modDependencies'

export interface Mod {
  /**
   * Path on disk
   */
  path: string
  /**
   * The mod id
   */
  id: string
  /**
   * Mod display name
   */
  name: string
  /**
   * Mod version
   */
  version: string
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
   * The backed resource
   */
  resource: Resource
}

function getUrl(resource: Resource) {
  return resource.uris.find(u => u?.startsWith('http')) ?? ''
}

export function getModItemFromResource(resource: Resource): Mod {
  const modItem: Mod = ({
    path: resource.path,
    id: '',
    name: resource.path,
    version: '',
    modLoaders: markRaw([]),
    description: '',
    provideRuntime: markRaw(getModProvides(resource)),
    icon: resource.icons?.at(-1) ?? '',
    dependencies: markRaw(getModDependencies(resource)),
    url: getUrl(resource),
    hash: resource.hash,
    tags: resource.tags,
    enabled: !resource.path.endsWith('.disabled'),
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
  if (resource.metadata.forge) {
    const meta = resource.metadata.forge
    modItem.id = meta.modid
    modItem.name = meta.name
    modItem.version = meta.version
    modItem.description = meta.description
  } else if (resource.metadata.fabric) {
    const meta = resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric
    modItem.id = meta.id
    modItem.version = meta.version
    modItem.name = meta.name ?? meta.id
    modItem.description = meta.description ?? ''
  } else if (resource.metadata.liteloader) {
    const meta = resource.metadata.liteloader
    modItem.name = meta.name
    modItem.version = meta.version ?? ''
    modItem.id = `${meta.name}`
    modItem.description = modItem.description ?? ''
  } else if (resource.metadata.quilt) {
    const meta = resource.metadata.quilt
    modItem.id = meta.quilt_loader.id
    modItem.version = meta.quilt_loader.version
    modItem.name = meta.quilt_loader.metadata?.name ?? meta.quilt_loader.id
    modItem.description = meta.quilt_loader.metadata?.description ?? ''
  } else {
    modItem.name = resource.fileName
  }
  if (!modItem.id) {
    modItem.id = resource.fileName + resource.hash.slice(0, 4)
  }
  if (!modItem.version) {
    modItem.version = '?'
  }
  if (!modItem.name) {
    modItem.name = resource.fileName
  }
  return markRaw(modItem)
}
