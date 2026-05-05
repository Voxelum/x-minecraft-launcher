import { Resource } from './Resource'
import { ResourceMetadata } from './ResourceMetadata'

export type ResourceActionTuple = [Resource, 0] | [string, 1] | [UpdateResourcePayload[], 2]

export interface ResourceState {
  /**
   * The mods under instance folder
   */
  files: Resource[]

  filesUpdates(ops: ResourceActionTuple[]): void
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

export type UpdateResourcePayload = {
  hash: string
  icons?: string[]
  metadata?: ResourceMetadata
  uris?: string[]
}
