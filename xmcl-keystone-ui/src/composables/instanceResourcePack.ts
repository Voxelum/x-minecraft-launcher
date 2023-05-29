import { PackMeta } from '@xmcl/resourcepack'
import { GameOptions, isPersistedResource, packFormatVersionRange, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { computed, Ref, InjectionKey } from 'vue'

import unknownPack from '@/assets/unknown_pack.png'
import { useDomainResources } from './resources'

export interface InstanceResourcePack extends PackMeta.Pack {
  /**
   * The resource pack file path
   */
  path: string
  /**
   * The display name of the resource pack
   */
  name: string
  /**
   * The id in resourcepack array in gamesetting file
   */
  id: string
  /**
   * The url of the resourcepack
   */
  url: string[]
  /**
   * The version range of the resource pack
   */
  acceptingRange: string
  /**
   * Icon url
   */
  icon: string
  /**
   * The tags of the resource pack
   */
  tags: string[]
  /**
   * The resource associate with the resourcepack item.
   * If it's undefined. Then this resource cannot be found.
   */
  resource?: Resource
}

export const kInstanceResourcePacks: InjectionKey<ReturnType<typeof useInstanceResourcePacks>> = Symbol('InstanceResourcePacks')

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks(gameOptions: Ref<GameOptions | undefined>) {
  const { resources, refresh, refreshing } = useDomainResources(ResourceDomain.ResourcePacks)
  const allResourcePacks = computed(() => resources.value.map(r => getResourcePackItem(r)))
  /**
   * Enabled pack item.
   * It's the REVERSED version of the resourcePacks array in options.txt (gamesetting).
   * It should be something like ['file/pack.zip', 'vanilla']
   */
  const enabled = computed(() => gameOptions.value?.resourcePacks?.map(name => getResourcePackItemFromGameSettingName(name, allResourcePacks.value)).reverse() || [])
  const enabledSet = computed(() => new Set(enabled.value?.map(v => v.id)))
  /**
   * Disabled pack item
   */
  const disabled = computed(() => allResourcePacks.value.filter((item) => !enabledSet.value.has(item.id)))

  function getResourcepackFormat(meta: any) {
    return meta ? meta.format ?? meta.pack_format : 3
  }
  function getResourcePackItem(resource: Resource): InstanceResourcePack {
    if (resource.metadata.resourcepack) {
      return markRaw({
        path: resource.path,
        name: resource.name,
        id: `file/${resource.fileName.endsWith('.zip') ? resource.fileName : resource.fileName + '.zip'}`,
        url: resource.uris,
        pack_format: resource.metadata.resourcepack.pack_format,
        description: resource.metadata.resourcepack.description,
        acceptingRange: packFormatVersionRange[getResourcepackFormat(resource.metadata.resourcepack)] ?? '[*]',
        icon: isPersistedResource(resource) ? resource.icons?.[0] ?? '' : '',
        tags: resource.tags,
        resource,
      })
    } else {
      return markRaw({
        path: resource.path,
        name: resource.name,
        id: `file/${resource.fileName.endsWith('.zip') ? resource.fileName : resource.fileName + '.zip'}`,
        url: resource.uris,
        pack_format: 0,
        description: '',
        acceptingRange: packFormatVersionRange[getResourcepackFormat(resource.metadata)] ?? '[*]',
        icon: isPersistedResource(resource) ? resource.icons?.[0] ?? '' : '',
        tags: resource.tags,
        resource,
      })
    }
  }
  function getResourcePackItemFromGameSettingName(resourcePackName: string, all: InstanceResourcePack[]): InstanceResourcePack {
    if (resourcePackName === 'vanilla') {
      return markRaw({
        path: '',
        acceptingRange: '[*]',
        icon: unknownPack,
        name: '',
        description: '',
        pack_format: 0,
        id: 'vanilla',
        url: [],
        tags: [],
      })
    }
    return markRaw(all.find((p) => p.id === resourcePackName || p.id === `file/${resourcePackName}`) ?? {
      path: `file/${resourcePackName}`,
      name: resourcePackName,
      acceptingRange: 'unknown',
      icon: unknownPack,
      description: '',
      pack_format: -1,
      id: resourcePackName.startsWith('file') ? resourcePackName : `file/${resourcePackName}`,
      url: [],
      tags: [],
    })
  }

  return {
    enabled,
    disabled,
    refreshing,
  }
}
