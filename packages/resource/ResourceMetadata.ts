import type { ModpackInstallProfile } from '@xmcl/instance'
import type { FabricModMetadata, LiteloaderModMetadata, QuiltModMetadata } from '@xmcl/mod-parser'
import type { PackMeta } from '@xmcl/resourcepack'
import { ForgeModCommonMetadata, NeoforgeMetadata } from './mod'
import { ResourceType } from './ResourceType'

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

export interface ResourceMetadata {
  name?: string
  forge?: ForgeModCommonMetadata
  neoforge?: NeoforgeMetadata
  [ResourceType.Fabric]?: FabricModMetadata | FabricModMetadata[]
  [ResourceType.Liteloader]?: LiteloaderModMetadata
  [ResourceType.Quilt]?: QuiltModMetadata
  [ResourceType.ResourcePack]?: PackMeta.Pack
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
