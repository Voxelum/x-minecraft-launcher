import type { FabricModMetadata, LiteloaderModMetadata } from '@xmcl/mod-parser'
import type { PackMeta } from '@xmcl/resourcepack'
import type { LevelDataFrame } from '@xmcl/world'
import { CurseforgeModpackManifest } from './curseforge'
import { ForgeModCommonMetadata } from './mod'
import { Modpack } from './modpack'
import { CurseforgeInformation, GithubInformation, PersistedResourceSchema, Resource, ResourceDomain, ResourceType } from './resource.schema'
import { ResourceSaveMetadata } from './save'

export interface PersistedResource<T = unknown> extends Readonly<Omit<PersistedResourceSchema, 'metadata' | 'version'>> {
  /**
   * The real path of the resource
   */
  readonly path: string

  readonly metadata: T
  /**
   * The ino of the file on disk
   */
  readonly ino: number
  /**
   * The size of the resource
   */
  readonly size: number
  /**
   * The suggested ext of the resource
   */
  readonly ext: string
}

export type ForgeResource = Resource<ForgeModCommonMetadata> & { readonly type: ResourceType.Forge }
export type FabricResource = Resource<FabricModMetadata> & { readonly type: ResourceType.Fabric }
export type LiteloaderResource = Resource<LiteloaderModMetadata> & { readonly type: ResourceType.Liteloader }
export type ResourcePackResource = Resource<PackMeta.Pack> & { readonly type: ResourceType.ResourcePack }
export type CurseforgeModpackResource = Resource<CurseforgeModpackManifest> & { readonly type: ResourceType.CurseforgeModpack }
export type McbbsModpackResource = Resource<Modpack> & { readonly type: ResourceType.McbbsModpack }
export type ModpackResource = Resource<Modpack> & { readonly type: ResourceType.Modpack }
export type SaveResource = Resource<ResourceSaveMetadata> & { readonly type: ResourceType.Save }
export type UnknownResource = Resource<unknown> & { readonly type: ResourceType.Unknown }
export type ModResource = ForgeResource | FabricResource | LiteloaderResource
export type AnyResource = ForgeResource
| FabricResource
| LiteloaderResource
| CurseforgeModpackResource
| ModpackResource
| ResourcePackResource
| SaveResource
| McbbsModpackResource
| UnknownResource

export type PersistedForgeResource = PersistedResource<ForgeModCommonMetadata> & { readonly type: ResourceType.Forge }
export type PersistedFabricResource = PersistedResource<FabricModMetadata> & { readonly type: ResourceType.Fabric }
export type PersistedLiteloaderResource = PersistedResource<LiteloaderModMetadata> & { readonly type: ResourceType.Liteloader }
export type PersistedResourcePackResource = PersistedResource<PackMeta.Pack> & { readonly type: ResourceType.ResourcePack }
export type PersistedCurseforgeModpackResource = PersistedResource<CurseforgeModpackManifest> & { readonly type: ResourceType.CurseforgeModpack }
export type PersistedMcbbsModpackResource = PersistedResource<Modpack> & { readonly type: ResourceType.McbbsModpack }
export type PersistedModpackResource = PersistedResource<Modpack> & { readonly type: ResourceType.Modpack }
export type PersistedSaveResource = PersistedResource<ResourceSaveMetadata> & { readonly type: ResourceType.Save }
export type PersistedUnknownResource = PersistedResource<unknown> & { readonly type: ResourceType.Unknown }
export type PersistedModResource = PersistedForgeResource | PersistedFabricResource | PersistedLiteloaderResource
export type AnyPersistedResource = PersistedForgeResource
| PersistedFabricResource
| PersistedLiteloaderResource
| PersistedCurseforgeModpackResource
| PersistedModpackResource
| PersistedResourcePackResource
| PersistedSaveResource
| PersistedMcbbsModpackResource
| PersistedUnknownResource

export function isForgeResource(resource: Resource): resource is ForgeResource {
  return resource.type === 'forge'
}

export function isFabricResource(resource: Resource): resource is FabricResource {
  return resource.type === 'fabric'
}

export function isResourcePackResource(resource: Resource): resource is ResourcePackResource {
  return resource.type === 'resourcepack'
}

export function isModResource(resource: Resource): resource is ModResource {
  return resource.type === 'forge' || resource.type === 'fabric' || resource.type === 'liteloader'
}

/**
 * Is this resource a raw modpack resource. The raw modpack means it just containing the .minecraft folder content itself
 */
export function isModpackResource(resource: Resource): resource is ModpackResource {
  return resource.type === ResourceType.Modpack
}

export function isSaveResource(resource: Resource): resource is SaveResource {
  return resource.type === ResourceType.Save
}

export const NO_RESOURCE: UnknownResource = Object.freeze({
  metadata: {},
  location: '',
  type: ResourceType.Unknown,
  domain: ResourceDomain.Unknown,
  ino: 0,
  size: 0,
  hash: '',
  ext: '',
  path: '',
  uri: [],
  fileType: 'unknown',
  name: '',
})

export interface SourceInformation {
  github?: GithubInformation
  curseforge?: CurseforgeInformation
}

export function isPersistedResource<T>(resource: Resource<T>): resource is PersistedResource<T> {
  const r = resource as any
  return r.tags instanceof Array && r.uri instanceof Array && typeof r.location === 'string' && typeof r.date === 'string'
}

// export function getResourceIdentifier(modObject: PersistedResource) {
//   if (modObject.type === 'forge' && modObject.metadata instanceof Array) {
//     const meta = modObject.metadata[0]
//     if (meta.modid && meta.version) {
//       return `forge://${meta.modid}/${meta.version}`
//     }
//   }
//   if (modObject.type === 'liteloader') {
//     const meta = modObject.metadata
//     if (meta.name && meta.version) {
//       return `liteloader://${meta.name}/${meta.version}`
//     }
//   }
//   if (typeof modObject.curseforge === 'object') {
//     const { fileId, projectId } = modObject.curseforge
//     if (fileId && projectId) {
//       return `curseforge://${projectId}/${fileId}`
//     }
//     if (fileId) {
//       return `curseforge://${fileId}`
//     }
//   }
//   return `resource://${modObject.hash}`
// }
