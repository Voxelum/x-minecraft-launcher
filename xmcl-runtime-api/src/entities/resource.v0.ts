/* eslint-disable no-redeclare */
import _ResourceSchema from './PersistedResourceSchema.json'
import { ResourceSourceCurseforge, ResourceSourceGit, ResourceSourceModrinth, ResourceDomain, ResourceType } from './resource'
import { Schema } from './schema'

export const PersistedResourceSchemaV0: Schema<PersistedResourceSchemaV0> = _ResourceSchema

interface ResourceBase<T> {
  /**
   * The identical file name of the resource without extension.
   * @default ''
   */
  fileName: string
  /**
   * The display name of the resource
   */
  name: string
  /**
   * The ino of the file on disk
   * @default 0
   */
  ino: number
  /**
   * The size of the resource
   * @default 0
   */
  size: number
  /**
   * The recorded extension of the resource
   */
  ext: string
  /**
   * The sha1 of the resource
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
   * The metadata of the resource
   */
  metadata: T

  uri: string[]
  /**
   * The file type
   * @default ""
   */
  fileType: string
}

/**
 * Represent a persisted resource
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface PersistedResourceSchemaV0 extends ResourceBase<object | object[]> {
  /**
   * @default 0
   */
  version: number
  /**
   * The resource extension name
   */
  ext: string
  /**
   * The name of the resource
   */
  name: string
  /**
   * The sha1 of the resource
   */
  hash: string
  /**
   * The resource type. Can be `forge`, `liteloader`, `resourcepack`, and etc.
   */
  type: ResourceType
  /**
   * The custom tag on this resource
   * @default []
   */
  tags: string[]
  /**
   * The domain of the resource. This decide where (which folder) the resource go
   */
  domain: ResourceDomain
  /**
   * The resource specific metadata read from the file
   */
  metadata: object | object[]
  /**
   * The source uris.
   * - For the forge mod, it will be the forge:///<modid>/<version>
   * - For the liteloader mod, it will be the liteloader:///<name>/<version>
   * - For the curseforge file, it will be the curseforge:///<fileId>
   *
   * If the source is remote resource, it might also contain the uri like https://host/paths
   * @default []
   */
  uri: string[]
  /**
   * The date of import
   * @default ""
   */
  date: string
  /**
   * The github info for this source. If this is imported from github release, iGitlikeInformation  */
  github?: ResourceSourceGit
  /**
   * The curseforge info for this source. If this is imported from curseforge, it will present.
   */
  curseforge?: ResourceSourceCurseforge
  /**
   * The modrinth info for this source.
   */
  modrinth?: ResourceSourceModrinth

  iconUri?: string
}
