import { Exception } from '../entities/exception'
import { ModpackResource, ModResource, Persisted, Resource, ResourceDomain, ResourceMetadata, ResourcePackResource, SaveResource, ShaderPackResource } from '../entities/resource'
import { GenericEventEmitter } from '../events'
import { ServiceKey, StatefulService } from './Service'

export declare type FileTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save'

export type PartialResourcePath = Partial<Resource> & { path: string }
export type PartialResourcePathResolved = PartialResourcePath & { hash: string; ino: number; fileType: string; size: number; fileName: string; name: string }
export type PartialResourceHash = Partial<Resource> & { hash: string }
export type ResourceKey = Resource | string

export interface ImportResourceOptions {
  resources: PartialResourcePath[]
  /**
   * Is import file task in background?
   */
  background?: boolean
  /**
   * If optional, the resource won't be import if we cannot parse it.
   */
  optional?: boolean
}

export interface ExportResourceOptions {
  resources: ResourceKey[]
  targetDirectory: string
}

export interface QueryResourcesOptions {
  domain?: ResourceDomain
  tags?: string[]
  keyword?: string
  uris?: string[]
}

export interface UpdateResourceOptions {
  resource: Resource | string
}

const domains = [
  ResourceDomain.Mods,
  ResourceDomain.ResourcePacks,
  ResourceDomain.Saves,
  ResourceDomain.Modpacks,
  ResourceDomain.ShaderPacks,
  ResourceDomain.Unclassified,
] as const

export class ResourceState {
  [ResourceDomain.Mods] = [] as Array<Persisted<ModResource>>
  [ResourceDomain.ResourcePacks] = [] as Array<Persisted<ResourcePackResource>>
  [ResourceDomain.Saves] = [] as Array<Persisted<SaveResource>>
  [ResourceDomain.Modpacks] = [] as Array<Persisted<ModpackResource>>
  [ResourceDomain.ShaderPacks] = [] as Array<Persisted<ShaderPackResource>>
  [ResourceDomain.Unclassified] = [] as Array<Persisted<ShaderPackResource>>

  /**
   * Query local resource by uri
   */
  get queryResource() {
    return (url: string) => {
      for (const domain of domains) {
        const resources = this[domain]
        for (const v of resources) {
          const uris = v.uri
          if (uris.some(u => u === url)) {
            return v
          }
        }
      }
      return undefined
    }
  }

  resource(res: Persisted<Resource>) {
    let domain: Array<Resource> | undefined
    switch (res.domain) {
      case ResourceDomain.Mods:
        domain = this.mods
        break
      case ResourceDomain.ResourcePacks:
        domain = this.resourcepacks
        break
      case ResourceDomain.Saves:
        domain = this.saves
        break
      case ResourceDomain.Modpacks:
        domain = this.modpacks
        break
      case ResourceDomain.ShaderPacks:
        domain = this.shaderpacks
        break
      case ResourceDomain.Unclassified:
        domain = this.unclassified
        break
    }
    if (domain) {
      if (domain.find((r) => r.hash === res.hash)) {
        this[res.domain] = domain.map((r) => r.hash === res.hash ? Object.freeze(res) as any : r)
      } else {
        domain.push(Object.freeze(res) as any)
      }
    } else {
      throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`)
    }
  }

  resources(all: Persisted<Resource>[]) {
    for (const res of all) {
      if (domains.indexOf(res.domain) !== -1) {
        const domain = this[res.domain] as Persisted<Resource>[]

        if (domain.find((r) => r.hash === res.hash)) {
          this[res.domain] = domain.map((r) => r.hash === res.hash ? Object.freeze(res) as any : r)
        } else {
          domain.push(Object.freeze(res) as any)
        }
      } else {
        throw new Error(`Cannot accept resource for unknown domain [${res.domain}]`)
      }
    }
  }

  resourcesRemove(resources: Persisted<Resource>[]) {
    const removal = new Set(resources.map((r) => r.hash))
    const domains = new Set(resources.map((r) => r.domain))
    for (const domain of domains) {
      this[domain] = (this[domain] as Persisted<Resource>[]).filter((r) => !removal.has(r.hash)) as any
    }
  }
}

interface ResourceServiceEventMap {
  'error': ResourceException

  'modpackImport': {
    path: string
    name: string
  }
}

/**
 * Resource service to manage the mod, resource pack, saves, modpack resources.
 * It maintain a preview for resources in memory
 */
export interface ResourceService extends StatefulService<ResourceState>, GenericEventEmitter<ResourceServiceEventMap> {
  load(domain: ResourceDomain): Promise<void>

  queryResources(query: QueryResourcesOptions): Promise<Resource[]>
  /**
   * Get the resource metadata.
   * @param key The key can be file path, ino, file hash (sha1)
   */
  getResource(key: string): Promise<Resource | undefined>
  /**
   * Remove a resource from the launcher
   * @param resourceOrKey
   */
  removeResource(resourceOrKey: ResourceKey): Promise<void>
  /**
   * Update the resource content.
   *
   * You can update `name`, `tags` in this method.
   *
   * @param resource The update resource payload.
   */
  updateResource(resource: PartialResourceHash): Promise<Persisted<Resource>>
  /**
   * Parse files as resources.
   *
   * Input the partial resource (at least file path is provided).
   *
   * If the resource existed, it will return the existed persisted resource.
   * @param partialResources The the partial resource to parse
   */
  resolveResource(partialResources: PartialResourcePath[]): Promise<Resource[]>
  /**
   * Import the resource from the same disk. This will parse the file and import it into our db by hard link.
   * If the file already existed, it will not re-import it again
   *
   * The original file will not be modified.
   *
   * If the `optional` in `options` is `true`, then this will not import if the resource cannot be identified
   *
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unclassified domain.
   */
  importResource(options: ImportResourceOptions): Promise<Persisted<Resource>[]>
  /**
   * Export the resources into target directory. This will simply copy the resource out.
   * If a resource is not found, the export process will be abort. This is not a transaction process.
   */
  exportResource(options: ExportResourceOptions): Promise<void>
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
