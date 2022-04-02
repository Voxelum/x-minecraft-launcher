import { Exception } from '../entities/exception'
import { AnyPersistedResource, AnyResource, PersistedCurseforgeModpackResource, PersistedFabricResource, PersistedForgeResource, PersistedLiteloaderResource, PersistedMcbbsModpackResource, PersistedModpackResource, PersistedResource, PersistedResourcePackResource, PersistedSaveResource, PersistedShaderPackResource, PersistedUnknownResource, SourceInformation } from '../entities/resource'
import { ResourceDomain } from '../entities/resource.schema'
import { ServiceKey, StatefulService } from './Service'

export declare type FileTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save'

export interface ParseResourceOptions {
  /**
     * The real file path of the resource
     */
  path: string
  /**
    * The hint for the import file type
    */
  type?: FileTypeHint
  /**
    * The extra info you want to provide to the source of the resource
    */
  source?: SourceInformation
  /**
    * The file urls
    */
  url?: string[]
}
export interface ImportResourceOptions extends ParseResourceOptions {
  /**
   * Require the resource to be these specific domain
   */
  restrictToDomain?: ResourceDomain
  /**
   * Is import file task in background?
   */
  background?: boolean
  /**
   * The url of the resource icon
   */
  iconUrl?: string
}
export interface ParseResourcesOptions {
  files: Array<ParseResourceOptions>
  /**
     * The hint for the import file type
     */
  type?: FileTypeHint
}
export interface ImportResourcesOptions extends ParseResourcesOptions {
  files: Array<ParseResourceOptions & {
    restrictToDomain?: ResourceDomain
    /**
     * The url of the resource icon
     */
    iconUrl?: string
  }>
  /**
   * Is import file task in background?
   */
  background?: boolean
  /**
   * Require the resource to be these specific domain
   */
  restrictToDomain?: ResourceDomain
}

export interface UpdateResourceOptions {
  resource: AnyResource | string
  name?: string
  tags?: string[]
}

const domains = [
  'mods',
  'resourcepacks',
  'saves',
  'modpacks',
  'unknowns',
  'shaderpacks',
] as const

export class ResourceState {
  mods = [] as Array<PersistedForgeResource | PersistedLiteloaderResource | PersistedFabricResource>
  resourcepacks = [] as Array<PersistedResourcePackResource>
  saves = [] as Array<PersistedSaveResource>
  modpacks = [] as Array<PersistedModpackResource | PersistedCurseforgeModpackResource | PersistedMcbbsModpackResource>
  shaderpacks = [] as Array<PersistedShaderPackResource>
  unknowns = [] as Array<PersistedUnknownResource>

  /**
  * Query local resource by uri
  * @param uri The uri
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

  resource(res: AnyPersistedResource) {
    let domain: Array<AnyResource> | undefined
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
      case ResourceDomain.Unknown:
        domain = this.unknowns
        break
      case ResourceDomain.ShaderPacks:
        domain = this.shaderpacks
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

  resources(all: AnyPersistedResource[]) {
    for (const res of all) {
      if (domains.indexOf(res.domain) !== -1) {
        const domain = this[res.domain] as AnyPersistedResource[]

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

  resourcesRemove(resources: AnyPersistedResource[]) {
    const removal = new Set(resources.map((r) => r.hash))
    const domains = new Set(resources.map((r) => r.domain))
    for (const domain of domains) {
      this[domain] = (this[domain] as PersistedResource[]).filter((r) => !removal.has(r.hash)) as any
    }
  }
}

/**
 * Resource service to manage the mod, resource pack, saves, modpack resources.
 * It maintain a preview for resources in memory
 */
export interface ResourceService extends StatefulService<ResourceState> {
  /**
   * Remove a resource from the launcher
   * @param resourceOrKey
   */
  removeResource(resourceOrKey: string | AnyPersistedResource): Promise<void>
  /**
   * Update the resource content.
   *
   * You can update `name`, `tags` in this method.
   * @param options The update resource payload
   */
  updateResource(options: UpdateResourceOptions): Promise<void>
  /**
   * Parse a single file as a resource and return the resource object.
   *
   * If the resource existed, it will return the existed persisted resource.
   * @param options The parse file option
   */
  resolveResource(options: ParseResourceOptions): Promise<[AnyResource, undefined | Uint8Array]>
  /**
   * Parse multiple files and return corresponding resources
   *
   * If the resource existed, it will return the existed persisted resource.
   * @param options The parse multiple files options
   */
  resolveResources(options: ParseResourcesOptions): Promise<[AnyResource, undefined | Uint8Array][]>
  /**
   * Import the resource into the launcher.
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
   */
  importResource(options: ImportResourceOptions): Promise<AnyPersistedResource>
  /**
    * Import the resource from the same disk. This will parse the file and import it into our db by hardlink.
    * If the file already existed, it will not re-import it again
    *
    * The original file will not be modified.
    *
    * @param options The options to import the resources
    *
    * @returns All import file in resource form. If the file cannot be parsed, it will be UNKNOWN_RESOURCE.
    */
  importResources(options: ImportResourcesOptions): Promise<AnyPersistedResource[]>
  /**
   * Export the resources into target directory. This will simply copy the resource out.
   * If a resource is not found, the export process will be abort. This is not a transaction process.
   */
  exportResource(payload: {
    resources: (string | AnyResource)[]
    targetDirectory: string
  }): Promise<void>
}

export const ResourceServiceKey: ServiceKey<ResourceService> = 'ResourceService'

export type ResourceExceptions = {
  type: 'deployLinkResourceOccupied'
  resource: PersistedResource<any>
} | {
  type: 'resourceNotFoundException'
  resource: string | AnyResource
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
