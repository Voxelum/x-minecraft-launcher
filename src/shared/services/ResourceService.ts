import { AnyPersistedResource, AnyResource, PersistedCurseforgeModpackResource, PersistedFabricResource, PersistedForgeResource, PersistedLiteloaderResource, PersistedModpackResource, PersistedResource, PersistedResourcePackResource, PersistedSaveResource, PersistedShaderPackResource, PersistedUnknownResource, SourceInformation } from '../entities/resource'
import { ResourceDomain } from '../entities/resource.schema'
import { requireString } from '../util/assert'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export declare type FileTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save'

export interface ParseFileOptions {
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
export interface ImportFileOptions extends ParseFileOptions {
  /**
   * Require the resource to be these specific domain
   */
  restrictToDomain?: ResourceDomain
  /**
   * Is import file task in background?
   */
  background?: boolean
}
export interface ParseFilesOptions {
  files: Array<ParseFileOptions>
  /**
     * The hint for the import file type
     */
  type?: FileTypeHint
}
export interface ImportFilesOptions extends ParseFilesOptions {
  files: Array<ParseFileOptions & {
    restrictToDomain?: ResourceDomain
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
  modpacks = [] as Array<PersistedModpackResource | PersistedCurseforgeModpackResource>
  shaderpacks = [] as Array<PersistedShaderPackResource>
  unknowns = [] as Array<PersistedUnknownResource>

  /**
  * Query local resource by uri
  * @param uri The uri
  */
  get queryResource() {
    return (url: string) => {
      requireString(url)
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
  resolveFile(options: ParseFileOptions): Promise<[AnyResource, undefined | Uint8Array]>
  /**
   * Parse multiple files and return corresponding resources
   * 
   * If the resource existed, it will return the existed persisted resource.
   * @param options The parse multiple files options
   */
  resolveFiles(options: ParseFilesOptions): Promise<[AnyResource, undefined | Uint8Array][]>
  /**
   * Import the resource into the launcher.
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
   */
  importFile(options: ImportFileOptions): Promise<AnyPersistedResource>
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
  importFiles(options: ImportFilesOptions): Promise<AnyPersistedResource[]>
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
export const ResourceServiceMethods: ServiceTemplate<ResourceService> = {
  removeResource: undefined,
  resolveFile: undefined,
  resolveFiles: undefined,
  importFile: undefined,
  importFiles: undefined,
  exportResource: undefined,
  state: undefined,
  updateResource: undefined
}
