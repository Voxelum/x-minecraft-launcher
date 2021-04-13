import unknownPack from '/@/assets/unknown_pack.png'
import { basename } from '/@/util/basename'
import { AnyResource, isPersistedResource, isResourcePackResource, PersistedResource } from '/@shared/entities/resource'
import { computed, onMounted, ref, Ref, watch } from '@vue/composition-api'
import { PackMeta } from '@xmcl/resourcepack'
import { useService, useStore } from '.'
import { useBusy } from './useSemaphore'
import { InstanceGameSettingServiceKey } from '/@shared/services/InstanceGameSettingService'
import { Resource } from '/@shared/entities/resource.schema'

export interface ResourcePackItem extends PackMeta.Pack {
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
  acceptingRange: string
  /**
   * Icon url
   */
  icon: string

  /**
   * The resource associate with the resourcepack item.
   * If it's undefined. Then this resource cannot be found.
   */
  resource?: AnyResource
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
  const { state, getters } = useStore()
  const { edit } = useService(InstanceGameSettingServiceKey)

  const loading = useBusy('mountResourcepacks')

  const instanceResourcePacks = computed(() => state.instanceResource.resourcepacks)
  /**
     * The resource pack name array.
     * It's the REVERSED version of the resourcePacks array in options.txt (gamesetting).
     * It should be something like ['file/pack.zip', 'vanilla']
     */
  const enabledResourcePackNames: Ref<string[]> = ref([])
  /**
     * Enabled pack item
     */
  const enabled = computed(() => enabledResourcePackNames.value.map(getResourcePackItemFromGameSettingName))
  const storage = computed(() => instanceResourcePacks.value.map(getResourcePackItemFromInstanceResource)
    .concat(state.resource.resourcepacks
      .filter(r => instanceResourcePacks.value.every(p => p.hash !== r.hash))
      .map(getResourcePackItem)))
  /**
     * Disabled pack item
     */
  const disabled = computed(() => storage.value.filter((item) => enabledResourcePackNames.value.indexOf(item.id) === -1))

  const modified = computed(() => {
    if (enabledResourcePackNames.value.length !== state.instanceGameSetting.resourcePacks.length) {
      return true
    }
    return enabledResourcePackNames.value.every((v, i) => state.instanceGameSetting.resourcePacks[i] !== v)
  })

  function getResourcepackFormat(meta: any) {
    return meta ? meta.format ?? meta.pack_format : 3
  }
  function getResourcePackItem(resource: Resource<PackMeta.Pack>): ResourcePackItem {
    const icon = isPersistedResource(resource) ? `dataroot://${resource.location}.png` : ''
    return {
      path: resource.path,
      name: resource.name,
      id: `file/${basename(resource.path)}`,
      url: resource.uri,
      pack_format: resource.metadata.pack_format,
      description: resource.metadata.description,
      acceptingRange: getters.getAcceptMinecraftRangeByFormat(getResourcepackFormat(resource.metadata)),
      icon,

      resource: Object.freeze(resource) as any,
    }
  }
  function getResourcePackItemFromInstanceResource(resource: AnyResource): ResourcePackItem {
    if (resource && isResourcePackResource(resource)) {
      return getResourcePackItem(resource)
    }
    return {
      path: resource.path,
      name: resource.name,
      url: [resource.uri[0]],
      id: `file/${basename(resource.path)}`,
      pack_format: -1,
      description: 'Unknown Pack',
      acceptingRange: '[*]',
      icon: unknownPack,

      resource: Object.freeze(resource),
    }
  }
  function getResourcePackItemFromGameSettingName(resourcePackName: string): ResourcePackItem {
    if (resourcePackName === 'vanilla') {
      return {
        path: '',
        acceptingRange: '[*]',
        icon: unknownPack,
        name: 'Default',
        description: 'The default look and feel of Minecraft',
        pack_format: 0,
        id: 'vanilla',
        url: [],
      }
    }
    const foundedItem = storage.value.find((p) => p.id === resourcePackName || p.id === `file/${resourcePackName}`)
    if (foundedItem) {
      return foundedItem
    }

    return {
      path: '',
      name: resourcePackName,
      acceptingRange: 'unknown',
      icon: unknownPack,
      description: '',
      pack_format: -1,
      id: resourcePackName.startsWith('file') ? resourcePackName : `file/${resourcePackName}`,
      url: [],
    }
  }

  /**
     * Add a new resource to the enabled list
     */
  function add(id: string, to?: string) {
    if (typeof to === 'undefined') {
      const found = disabled.value.find(m => m.id === id)
      if (found) {
        enabledResourcePackNames.value.push(id)
      }
    } else {
      const index = enabledResourcePackNames.value.indexOf(to)
      if (index !== -1) {
        enabledResourcePackNames.value.splice(index, 0, id)
        enabledResourcePackNames.value = [...enabledResourcePackNames.value]
      } else {
        enabledResourcePackNames.value.push(id)
      }
    }
  }

  /**
     * Remove a resource from enabled list
     */
  function remove(id: string) {
    if (id === 'vanilla') {
      return
    }
    enabledResourcePackNames.value = enabledResourcePackNames.value.filter((name) => name !== id)
  }

  function insert(from: string, to: string) {
    const packs = enabledResourcePackNames.value
    const temp = packs.splice(packs.findIndex(p => p === from), 1)
    packs.splice(packs.findIndex(p => p === to), 0, ...temp)
    enabledResourcePackNames.value = [...packs]
  }

  /**
     * Commit the change for current mods setting
     */
  function commit() {
    edit({ resourcePacks: [...enabledResourcePackNames.value].reverse() })
  }

  const settingedResourcePacks = computed(() => state.instanceGameSetting.resourcePacks)
  watch(settingedResourcePacks, (packs) => {
    const arr = [...packs.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))]
    if (arr.indexOf('vanilla') === -1) {
      arr.unshift('vanilla')
    }
    enabledResourcePackNames.value = arr.reverse()
  })
  onMounted(() => {
    const arr = [...settingedResourcePacks.value.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))]
    if (arr.indexOf('vanilla') === -1) {
      arr.unshift('vanilla')
    }
    enabledResourcePackNames.value = arr.reverse()
  })

  return {
    modified,
    enabled,
    disabled,
    add,
    remove,
    commit,
    insert,
    loading,
  }
}
