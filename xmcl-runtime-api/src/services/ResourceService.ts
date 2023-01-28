import { Exception } from '../entities/exception'
import { Persisted, Resource, ResourceDomain, ResourceMetadata } from '../entities/resource'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

export declare type FileTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save'

export type PartialResourcePath = Partial<Resource> & { path: string }
export type ResolveResourceOptions = { path: string; domain?: ResourceDomain }
export type PartialResourcePathResolved = PartialResourcePath & { hash: string; ino: number; fileType: string; size: number; fileName: string; name: string }
export type PartialResourceHash = Partial<Resource> & { hash: string }
export type ResourceKey = Resource | string

export interface ImportResourceOptions extends ResolveResourceOptions {
  uris?: string[]
  metadata?: ResourceMetadata
  icons?: string[]
}

export interface ExportResourceOptions {
  resources: ResourceKey[]
  targetDirectory: string
}

export interface QueryResourcesOptions {
  domain?: ResourceDomain
  uris?: string[]
}

export interface UpdateResourceOptions {
  resource: Resource | string
}

interface ResourceServiceEventMap {
  'error': ResourceException

  'resourceAdd': Resource
  'resourceRemove': { sha1: string; domain: ResourceDomain }
  'resourceUpdate': Resource
}

/**
 * Resource service to manage the mod, resource pack, saves, modpack resources.
 * It maintain a preview for resources in memory
 */
export interface ResourceService extends GenericEventEmitter<ResourceServiceEventMap> {
  getResources(domain: ResourceDomain): Promise<Array<Resource>>
  getReosurceByIno(ino: number): Promise<Resource | undefined>
  getResourceByHash(sha1: string): Promise<Resource | undefined>
  getResourcesByHashes(sha1: string[]): Promise<Array<Resource | undefined>>
  getResourcesByUris(uri: [string]): Promise<[Resource | undefined]>
  getResourcesByUris(uri: [string, string]): Promise<[Resource | undefined, Resource | undefined]>
  getResourcesByUris(uri: string[]): Promise<Array<Resource | undefined>>

  getResourceMetadataByHash(sha1: string): Promise<ResourceMetadata | undefined>
  getResourcesMetadataByHashes(sha1: string[]): Promise<Array<ResourceMetadata | undefined>>

  getResourcesUnder(options: { fileNames: string[]; domain: ResourceDomain }): Promise<Array<Resource | undefined>>
  /**
   * Remove resources from the disk
   *
   * @param hashes The sha1 array of the resources
   */
  removeResources(hashes: string[]): Promise<void>
  /**
   * Update the resources content.
   *
   * You can update `name`, `tags` in this method.
   *
   * @param resource The update resource payload.
   *
   * @return The sha1 array of the resources are successfully updated
   */
  updateResources(resources: [PartialResourceHash, PartialResourceHash]): Promise<[string, string]>
  updateResources(resources: [PartialResourceHash]): Promise<[string]>
  updateResources(resources: PartialResourceHash[]): Promise<string[]>
  /**
   * Parse files as resources.
   *
   * Input the partial resource (at least file path is provided).
   *
   * If the resource existed, it will return the existed persisted resource.
   * @param options The the partial resource to parse
   */
  resolveResources(options: [ResolveResourceOptions, ResolveResourceOptions]): Promise<[Resource, Resource]>
  resolveResources(options: [ResolveResourceOptions]): Promise<[Resource]>
  resolveResources(options: ResolveResourceOptions[]): Promise<Resource[]>
  /**
   * Try to import the resource to the storage. This will parse the file and import it into our db by hard link.
   * If the file already existed, it will not re-import it again.
   *
   * The original file will not be modified.
   *
   * If the `optional` in `options` is `true`, then this will not import if the resource cannot be identified
   *
   * The return resource will be has the `path`
   *
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unclassified domain.
   */
  importResources(options: [ImportResourceOptions, ImportResourceOptions]): Promise<[Resource, Resource]>
  importResources(options: [ImportResourceOptions]): Promise<[Resource]>
  importResources(options: ImportResourceOptions[]): Promise<Resource[]>
  /**
   * Export the resources into target directory. This will simply copy the resource out.
   *
   * @returns The path of the final exported resources
   */
  exportResources(options: ExportResourceOptions): Promise<string[]>

  install(options: { instancePath: string; resource: Resource }): Promise<void>
}

export const ResourceServiceKey: ServiceKey<ResourceService> = 'ResourceService'

export type ResourceExceptions = {
  type: 'deployLinkResourceOccupied'
  resource: Persisted<any>
} | {
  type: 'resourceNotFoundException'
  resource: string | Resource
} | {
  type: 'resourceDomainMismatched'
  path: string
  expectedDomain: string
  actualDomain: string
  actualType: string
} | {
  type: 'resourceImportDirectoryException'
  path: string
}

export class ResourceException extends Exception<ResourceExceptions> { }
