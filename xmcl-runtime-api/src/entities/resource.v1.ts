import type { FabricModMetadata, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import type { PackMeta } from '@xmcl/resourcepack'
import { ForgeModCommonMetadata } from './mod'
import { CurseforgeModpackManifest, McbbsModpackManifest, Modpack, ModrinthModpackManifest } from './modpack'
import { ResourceDomain, ResourceType } from './resource'
import { ResourceSaveMetadata } from './save'

export interface ResourceMetadata<T = unknown> {
  version: 1
  /**
   * The display name of the resource
   */
  name: string
  /**
   * The original file name when this resource is imported with extension
   */
  fileName: string
  /**
   * The uri of the resource. Used for indexing
   */
  uri: string[]
  /**
   * The sha1 of the resource. This is the primary key of the resource.
   */
  hash: string
  /**
   * The resource type. Can be `forge`, `liteloader`, `resourcepack`, and etc.
   */
  type: ResourceType
  /**
   * The expect domain of the resource. This decide where (which folder) the resource should go
   */
  domain: ResourceDomain
  /**
   * The size of the resource
   * @default 0
   */
  size: number
  /**
   * The metadata of the resource
   */
  metadata: T
  /**
   * The tag on this file
   */
  tags: string[]

  fileType: string

  iconUrl?: string
}

/**
 * The interface represent a resource
 */
export interface Resource<T = unknown> extends ResourceMetadata<T> {
  /**
   * The path of the resource file
   */
  path: string
  ino: number

  storedPath?: string
  storedDate?: number
}

export interface PersistedResource<T = unknown> extends Resource<T> {
  storedPath: string
  storedDate: number
}

export type ForgeResource = Resource<ForgeModCommonMetadata> & { readonly type: ResourceType.Forge }
export type FabricResource = Resource<FabricModMetadata> & { readonly type: ResourceType.Fabric }
export type QuiltResource = Resource<QuiltModMetadata> & { readonly type: ResourceType.Quilt }
export type LiteloaderResource = Resource<LiteloaderModMetadata> & { readonly type: ResourceType.Liteloader }
export type ResourcePackResource = Resource<PackMeta.Pack> & { readonly type: ResourceType.ResourcePack }
export type CurseforgeModpackResource = Resource<CurseforgeModpackManifest> & { readonly type: ResourceType.CurseforgeModpack }
export type McbbsModpackResource = Resource<McbbsModpackManifest> & { readonly type: ResourceType.McbbsModpack }
export type ModrinthModpackResource = Resource<ModrinthModpackManifest> & { readonly type: ResourceType.ModrinthModpack }
export type ModpackResource = Resource<Modpack> & { readonly type: ResourceType.Modpack }
export type SaveResource = Resource<ResourceSaveMetadata> & { readonly type: ResourceType.Save }
export type ShaderPackResource = Resource<ShaderPackResource> & { readonly type: ResourceType.ShaderPack }
export type UnknownResource = Resource<unknown> & { readonly type: 'unknown' }
export type ModResource = ForgeResource | FabricResource | LiteloaderResource
export type AnyResource = ForgeResource
| FabricResource
| QuiltResource
| LiteloaderResource
| CurseforgeModpackResource
| ModpackResource
| ResourcePackResource
| SaveResource
| McbbsModpackResource
| ModrinthModpackResource
| ShaderPackResource
| UnknownResource

export type PersistedForgeResource = PersistedResource<ForgeModCommonMetadata> & { readonly type: ResourceType.Forge }
export type PersistedFabricResource = PersistedResource<FabricModMetadata> & { readonly type: ResourceType.Fabric }
export type PersistedQuiltResource = PersistedResource<QuiltModMetadata> & { readonly type: ResourceType.Quilt }
export type PersistedLiteloaderResource = PersistedResource<LiteloaderModMetadata> & { readonly type: ResourceType.Liteloader }
export type PersistedResourcePackResource = PersistedResource<PackMeta.Pack> & { readonly type: ResourceType.ResourcePack }
export type PersistedCurseforgeModpackResource = PersistedResource<CurseforgeModpackManifest> & { readonly type: ResourceType.CurseforgeModpack }
export type PersistedMcbbsModpackResource = PersistedResource<McbbsModpackManifest> & { readonly type: ResourceType.McbbsModpack }
export type PersistedModrinthModpackResource = PersistedResource<ModrinthModpackManifest> & { readonly type: ResourceType.ModrinthModpack }
export type PersistedModpackResource = PersistedResource<Modpack> & { readonly type: ResourceType.Modpack }
export type PersistedSaveResource = PersistedResource<ResourceSaveMetadata> & { readonly type: ResourceType.Save }
export type PersistedShaderPackResource = PersistedResource<ShaderPackResource> & { readonly type: ResourceType.ShaderPack }
export type PersistedUnknownResource = PersistedResource<unknown> & { readonly type: 'unknown' }
export type PersistedModResource = PersistedForgeResource | PersistedFabricResource | PersistedLiteloaderResource
export type AnyPersistedResource = PersistedForgeResource
| PersistedFabricResource
| PersistedQuiltResource
| PersistedLiteloaderResource
| PersistedCurseforgeModpackResource
| PersistedModpackResource
| PersistedResourcePackResource
| PersistedSaveResource
| PersistedMcbbsModpackResource
| PersistedModrinthModpackResource
| PersistedShaderPackResource
| PersistedUnknownResource
