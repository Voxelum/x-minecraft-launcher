import { Resource } from './Resource'
import { ResourceMetadata } from './ResourceMetadata'

export type ResourceActionTuple = [Resource, 0] | [string, 1] | [UpdateResourcePayload[], 2]

export type ResourceErrorActionTuple = [ResourceError, 0] | [string, 1]

export interface ResourceError {
  path: string
  code: string
}

export interface ResourceState {
  /**
   * The mods under instance folder
   */
  files: Resource[]

  /**
   * Files in this directory that could not be parsed (broken/corrupted
   * zips, permission errors, …). Surfaced so the UI can tell the user
   * *which* file is broken instead of silently dropping it.
   *
   * Keyed by `path` — re-adding the same path replaces the entry, and a
   * successful upsert of the same path (i.e. the user fixed it) clears
   * it via a `Remove` action.
   */
  errors: ResourceError[]

  filesUpdates(ops: ResourceActionTuple[]): void

  errorsUpdates(ops: ResourceErrorActionTuple[]): void
}

export /* @__PURE__ */ const enum ResourceAction {
  /**
   * Upsert a resource
   */
  Upsert = 0,
  /**
   * Remove a resource file
   */
  Remove = 1,
  /**
   * Update multiple resources metadata
   */
  BatchUpdate = 2,
}

export /* @__PURE__ */ const enum ResourceErrorAction {
  /**
   * Upsert a resource parse error
   */
  Upsert = 0,
  /**
   * Remove a resource parse error by path (the file is gone or now parses)
   */
  Remove = 1,
}

export type UpdateResourcePayload = {
  hash: string
  icons?: string[]
  metadata?: ResourceMetadata
  uris?: string[]
}
