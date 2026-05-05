import { PackMeta } from './format'
import { ResourcePack, Resource, ResourceLocation } from './resourcePack'

export interface ResourcePackWrapper {
  source: ResourcePack
  info: PackMeta.Pack
  domains: string[]
}

export interface ResourceLoader {
  /**
   * Get the resource in that location. This will walk through current resource source list to load the resource.
   * @param location The resource location
   */
  get(location: ResourceLocation): Promise<Resource | undefined>
}

/**
 * The resource manager just like Minecraft. Design to be able to use in both nodejs and browser environment.
 */
export class ResourceManager<
  T extends ResourcePackWrapper = ResourcePackWrapper,
> implements ResourceLoader {
  constructor(
    /**
     * The list order is just like the order in options.txt. The last element is the highest priority one.
     * The resource will load from the last one to the first one.
     */
    public list: Array<ResourcePackWrapper> = [],
  ) {}

  get allResourcePacks() {
    return this.list.map((l) => l.info)
  }

  /**
   * Add a new resource source as the first priority of the resource list.
   */
  async addResourcePack(resourcePack: ResourcePack) {
    let info
    try {
      info = await resourcePack.info()
    } catch {
      info = { pack_format: -1, description: '' }
    }
    const domains = await resourcePack.domains()
    const wrapper = { info, source: resourcePack, domains }

    this.list.push(wrapper)

    return wrapper
  }

  remove(index: number) {
    return this.list.splice(index, 1)[0]
  }

  /**
   * Clear all resource packs in this manager
   */
  clear() {
    return this.list.splice(0, this.list.length)
  }

  /**
   * Swap the resource source priority.
   */
  swap(first: number, second: number) {
    if (first >= this.list.length || first < 0 || second >= this.list.length || second < 0) {
      throw new Error('Illegal index')
    }

    const fir = this.list[first]
    this.list[first] = this.list[second]
    this.list[second] = fir
  }

  /**
   * Get the resource in that location. This will walk through current resource source list to load the resource.
   * @param location The resource location
   */
  async get(location: ResourceLocation): Promise<Resource | undefined> {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const src = this.list[i]
      const resource = await src.source.get(location)
      if (resource) {
        return resource
      }
    }
    return undefined
  }
}
