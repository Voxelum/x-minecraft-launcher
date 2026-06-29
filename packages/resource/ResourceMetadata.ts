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

/**
 * Modrinth project / version / user ids are 8-character base62 strings.
 * Anything else (most commonly a leaked file path stored under
 * `resource.metadata.modrinth.versionId` by older builds, third-party
 * importers or hand-edited json) will round-trip through the API as a
 * 400 "Invalid character in base62 encoding" and kill the entire batch.
 * Validate before persisting or forwarding.
 */
const MODRINTH_ID_RE = /^[0-9A-Za-z]{8}$/
export function isValidModrinthId(id: unknown): id is string {
  return typeof id === 'string' && MODRINTH_ID_RE.test(id)
}
export function isValidModrinthRef(m: Partial<ResourceSourceModrinth> | undefined | null): m is ResourceSourceModrinth {
  return !!m && isValidModrinthId(m.projectId) && isValidModrinthId(m.versionId)
}

/**
 * CurseForge project / file ids are positive integers; same class of leak applies.
 */
export function isValidCurseforgeRef(c: Partial<ResourceSourceCurseforge> | undefined | null): c is ResourceSourceCurseforge {
  return !!c && Number.isInteger(c.projectId) && Number.isInteger(c.fileId) &&
    (c.projectId as number) > 0 && (c.fileId as number) > 0
}

export interface BlueprintMetadata {
  /**
   * The blueprint format, e.g. `litematic`, `schem`, `structure`, `buildinggadget`.
   */
  format: string
  size: { x: number; y: number; z: number }
  /**
   * The number of non-air blocks.
   */
  blockCount: number
  /**
   * The number of distinct block ids used.
   */
  blockTypeCount: number
  dataVersion?: number
  author?: string
  /**
   * Material list (block id -> count), sorted descending.
   */
  materials: { block: string; count: number }[]
  /**
   * Block state palette; index 0 is air.
   */
  palette: { name: string; properties?: Record<string, string> }[]
  /**
   * Flattened `[x, y, z, paletteIndex]` quadruples for every non-air block,
   * used by the 3D preview.
   */
  voxels: number[]
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
   * The blueprint/schematic metadata.
   */
  [ResourceType.Blueprint]?: BlueprintMetadata
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
