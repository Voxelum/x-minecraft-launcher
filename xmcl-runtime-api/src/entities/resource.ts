import type { FabricModMetadata, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import type { PackMeta } from '@xmcl/resourcepack'
import { ForgeModCommonMetadata } from './mod'
import { CurseforgeModpackManifest, McbbsModpackManifest, Modpack, ModrinthModpackManifest } from './modpack'
import { ResourceSaveMetadata } from './save'

export interface ResourceSourceCurseforge {
  /**
   * The curseforge project id
   */
  projectId: number
  /**
   * The curseforge file id
   */
  fileId: number
}

export interface ResourceSourceGit {
  /**
   * The owner name. Either a username or an organization name
   */
  owner: string
  /**
   * The repo name
   */
  repo: string
  /**
   * The release artifact id
   */
  artifact?: string
  url?: string
}

export interface ResourceSourceModrinth {
  /**
   * The mod id of the mod
   */
  projectId: string
  /**
   * The version id of the mod version
   */
  versionId: string
  /**
   * The file name of the file
   */
  filename: string
  /**
   * The download url of the file
   */
  url: string
}

export enum ResourceType {
  Forge = 'forge',
  Liteloader = 'liteloader',
  Fabric = 'fabric',
  Quilt = 'quilt',
  Modpack = 'modpack',
  CurseforgeModpack = 'curseforge-modpack',
  McbbsModpack = 'mcbbs-modpack',
  ModrinthModpack = 'modrinth-modpack',
  Save = 'save',
  ResourcePack = 'resourcepack',
  ShaderPack = 'shaderpack',
  Unknown = 'unknown',
}

export enum ResourceDomain {
  Mods = 'mods',
  Saves = 'saves',
  ResourcePacks = 'resourcepacks',
  ShaderPacks = 'shaderpacks',
  Modpacks = 'modpacks',
  Unknown = 'unknowns',
}

export interface ResourceSources {
  /**
   * The github info for this source. If this is imported from github release, it will present.
   */
  github?: ResourceSourceGit
  /**
   * The curseforge info for this source. If this is imported from curseforge, it will present.
   */
  curseforge?: ResourceSourceCurseforge
  /**
   * The modrinth info for this source.
   */
  modrinth?: ResourceSourceModrinth
  /**
   * The gitlab project information
   */
  gitlab?: ResourceSourceGit
}

export interface ResourceMetadata<T = unknown> extends ResourceSources {
  version: number
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
export type UnknownResource = Resource<unknown> & { readonly type: ResourceType.Unknown }
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
export type PersistedUnknownResource = PersistedResource<unknown> & { readonly type: ResourceType.Unknown }
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

export function isForgeResource(resource: Resource): resource is ForgeResource {
  return resource.type === 'forge'
}

export function isFabricResource(resource: Resource): resource is FabricResource {
  return resource.type === 'fabric'
}

export function isQuiltResource(resource: Resource): resource is QuiltResource {
  return resource.type === 'quilt'
}

export function isLiteloaderResource(resource: Resource): resource is LiteloaderResource {
  return resource.type === 'liteloader'
}

export function isResourcePackResource(resource: Resource): resource is ResourcePackResource {
  return resource.type === 'resourcepack'
}

export function isModResource(resource: Resource): resource is ModResource {
  return resource.type === 'forge' || resource.type === 'fabric' || resource.type === 'liteloader' || resource.type === 'quilt'
}

export function isShaderPackResource(resource: Resource): resource is ShaderPackResource {
  return resource.type === 'shaderpack'
}
/**
 * Is this resource a raw modpack resource. The raw modpack means it just containing the .minecraft folder content itself
 */
export function isModpackResource(resource: Resource): resource is ModpackResource {
  return resource.type === ResourceType.Modpack
}

export function isCurseforgeModpackResource(resource: Resource): resource is CurseforgeModpackResource {
  return resource.type === ResourceType.CurseforgeModpack
}

export function isSaveResource(resource: Resource): resource is SaveResource {
  return resource.type === ResourceType.Save
}

export function isPersistedResource<T>(resource: Resource<T>): resource is PersistedResource<T> {
  return !!resource.storedDate && !!resource.storedPath
}
