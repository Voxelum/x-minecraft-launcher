import type { FabricModMetadata, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import type { PackMeta } from '@xmcl/resourcepack'
import { ForgeModCommonMetadata } from './mod'
import { File } from './File'
import { ResourceMetadata } from './ResourceMetadata'
import { ResourceType } from './ResourceType'
import { ResourceDomain } from './ResourceDomain'

export interface Resource extends File {
  /**
   * Latest version is `3`
   */
  version: number
  /**
   * The name of the resource
   */
  name: string
  /**
   * The sha1 hash of the resource file
   */
  hash: string
  /**
   * The icon urls
   */
  icons?: string[]
  /**
   * The resource metadata
   */
  metadata: ResourceMetadata
}

export type ForgeResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Mods
  metadata: { [ResourceType.Forge]: ForgeModCommonMetadata }
}

export type FabricResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Mods
  metadata: { [ResourceType.Fabric]: FabricModMetadata | FabricModMetadata[] }
}

export type QuiltResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Mods
  metadata: { [ResourceType.Quilt]: QuiltModMetadata }
}

export type LiteloaderResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Mods
  metadata: { [ResourceType.Liteloader]: LiteloaderModMetadata }
}

export type ResourcePackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.ResourcePacks
  metadata: { [ResourceType.ResourcePack]: PackMeta.Pack }
}

export type ShaderPackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.ShaderPacks
  metadata: { [ResourceType.ShaderPack]: {} }
}

export function isForgeResource<T extends Resource>(resource: T): resource is ForgeResource<T> {
  return !!resource.metadata.forge
}

export function isFabricResource(resource: Resource): resource is FabricResource {
  return !!resource.metadata.fabric
}

export function isQuiltResource(resource: Resource): resource is QuiltResource {
  return !!resource.metadata.quilt
}

export function isLiteloaderResource(resource: Resource): resource is LiteloaderResource {
  return !!resource.metadata.liteloader
}

export function isResourcePackResource(resource: Resource): resource is ResourcePackResource {
  return !!resource.metadata.resourcepack
}
