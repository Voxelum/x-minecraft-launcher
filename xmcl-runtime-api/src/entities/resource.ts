import type { FabricModMetadata, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import type { PackMeta } from '@xmcl/resourcepack'
import { ForgeModCommonMetadata } from './mod'
import { CurseforgeModpackManifest, McbbsModpackManifest, MMCModpackManifest, Modpack, ModrinthModpackManifest } from './modpack'
import { ResourceSaveMetadata } from './save'
import { ModpackInstallProfile } from '../services/ModpackService'

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
}

export enum ResourceType {
  Forge = 'forge',
  Liteloader = 'liteloader',
  Fabric = 'fabric',
  Quilt = 'quilt',
  Modpack = 'modpack',
  CurseforgeModpack = 'curseforge-modpack',
  McbbsModpack = 'mcbbs-modpack',
  MMCModpack = 'mmc-modpack',
  ModrinthModpack = 'modrinth-modpack',
  Save = 'save',
  ResourcePack = 'resourcepack',
  ShaderPack = 'shaderpack',
}

export enum ResourceDomain {
  Mods = 'mods',
  Saves = 'saves',
  ResourcePacks = 'resourcepacks',
  ShaderPacks = 'shaderpacks',
  Modpacks = 'modpacks',
  Unclassified = 'unclassified',
}

export interface ResourceMetadata {
  [ResourceType.Forge]?: ForgeModCommonMetadata
  [ResourceType.Fabric]?: FabricModMetadata | FabricModMetadata[]
  [ResourceType.Liteloader]?: LiteloaderModMetadata
  [ResourceType.Quilt]?: QuiltModMetadata
  [ResourceType.ResourcePack]?: PackMeta.Pack
  [ResourceType.CurseforgeModpack]?: CurseforgeModpackManifest
  [ResourceType.McbbsModpack]?: McbbsModpackManifest
  [ResourceType.MMCModpack]?: MMCModpackManifest
  [ResourceType.ModrinthModpack]?: ModrinthModpackManifest
  [ResourceType.Modpack]?: Modpack
  [ResourceType.Save]?: ResourceSaveMetadata
  [ResourceType.ShaderPack]?: {}
  /**
   * The data to create instance from this resource.
   *
   * This should only existed in modpack resource
   */
  instance?: ModpackInstallProfile
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
/**
 * The resource representing a file metadata
 */
export interface Resource {
  /**
   * Latest version is `2`
   */
  version: number
  /**
   * The sha1 of the resource. This is the primary key of the resource.
   */
  hash: string
  /**
   * The display name of the resource.
   */
  name: string
  /**
   * The original file name when this resource is imported with extension.
   */
  fileName: string
  /**
   * The file type, can be `zip` or `directory`
   */
  fileType: string
  /**
   * The size of the resource
   * @default 0
   */
  size: number
  /**
   * The tag on this file. Used for indexing.
   */
  tags: string[]
  /**
   * The uri of the resource. Used for indexing
   */
  uris: string[]
  /**
   * The expect domain of the resource. This decide where (which folder) the resource should go
   */
  domain: ResourceDomain
  /**
   * The icon urls
   */
  icons?: string[]
  /**
   * The persisted resource file path
   */
  storedPath?: string

  storedDate?: number

  mtime: number
  /**
   * The resource metadata
   */
  metadata: ResourceMetadata
  /**
   * The path of the resource file
   */
  path: string
  /**
   * The ino of the file
   */
  ino: number
}

export type Persisted<T extends Resource> = T & {
  storedPath: string
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

export type CurseforgeModpackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Modpacks
  metadata: { [ResourceType.CurseforgeModpack]: CurseforgeModpackManifest }
}

export type McbbsModpackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Modpacks
  metadata: { [ResourceType.McbbsModpack]: McbbsModpackManifest }
}

export type ModrinthModpackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Modpacks
  metadata: { [ResourceType.ModrinthModpack]: ModrinthModpackManifest }
}

export type RawModpackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Modpacks
  metadata: { [ResourceType.Modpack]: Modpack }
}

export type ModpackResource = RawModpackResource | ModrinthModpackResource | CurseforgeModpackResource | McbbsModpackResource

export type SaveResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.Modpacks
  metadata: { [ResourceType.Save]: ResourceSaveMetadata }
}

export type ShaderPackResource<T extends Resource = Resource> = T & {
  readonly domain: ResourceDomain.ShaderPacks
  metadata: { [ResourceType.ShaderPack]: {} }
}

export type ModResource = ForgeResource | FabricResource | LiteloaderResource

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

export function isModResource(resource: Resource): resource is ModResource {
  return resource.domain === ResourceDomain.Mods
}

export function isShaderPackResource(resource: Resource): resource is ShaderPackResource {
  return resource.domain === ResourceDomain.ShaderPacks
}
/**
 * Is this resource a raw modpack resource. The raw modpack means it just containing the .minecraft folder content itself
 */
export function isModpackResource(resource: Resource): resource is ModpackResource {
  return resource.domain === ResourceDomain.Modpacks
}

export function isRawModpackResource(resource: Resource): resource is RawModpackResource {
  return !!resource.metadata.modpack
}

export function isCurseforgeModpackResource(resource: Resource): resource is CurseforgeModpackResource {
  return !!resource.metadata['curseforge-modpack']
}

export function isModrinthModpackResource(resource: Resource): resource is ModrinthModpackResource {
  return !!resource.metadata['modrinth-modpack']
}

export function isMcbbsModpackResource(resource: Resource): resource is McbbsModpackResource {
  return !!resource.metadata['mcbbs-modpack']
}

export function isSaveResource(resource: Resource): resource is SaveResource {
  return resource.domain === ResourceDomain.Saves
}

export function isPersistedResource<T extends Resource>(resource: T): resource is Persisted<T> {
  return !!resource.storedPath
}
