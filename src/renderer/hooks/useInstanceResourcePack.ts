import { computed, onMounted, reactive, ref, Ref, watch } from '@vue/composition-api'
import { PackMeta } from '@xmcl/resourcepack'
import { useService } from '.'
import { useBusy } from './useSemaphore'
import unknownPack from '/@/assets/unknown_pack.png'
import { basename } from '/@/util/basename'
import { AnyResource, isPersistedResource, PersistedResourcePackResource } from '/@shared/entities/resource'
import { Resource } from '/@shared/entities/resource.schema'
import { InstanceOptionsServiceKey } from '../../shared/services/InstanceOptionsService'
import { ResourceServiceKey } from '/@shared/services/ResourceService'
import mappings from '/@shared/util/packFormatVersionRange'
import { isStringArrayEquals } from '../util/equal'

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

  tags: string[]

  /**
   * The resource associate with the resourcepack item.
   * If it's undefined. Then this resource cannot be found.
   */
  resource?: PersistedResourcePackResource
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
  const { state: gameSettingState, editGameSetting } = useService(InstanceOptionsServiceKey)
  const { state: resourceState, updateResource } = useService(ResourceServiceKey)

  const loading = useBusy('editGameSetting')
  /**
   * The resource pack name array.
   * It's the REVERSED version of the resourcePacks array in options.txt (gamesetting).
   * It should be something like ['file/pack.zip', 'vanilla']
   */
  const enabledResourcePackNames: Ref<string[]> = ref([])
  const optionsResourcePacks = computed(() => gameSettingState.options.resourcePacks)
  /**
   * Enabled pack item
   */
  const enabled = computed(() => enabledResourcePackNames.value.map(getResourcePackItemFromGameSettingName))
  const storage = ref([] as ResourcePackItem[])
  /**
   * Disabled pack item
   */
  const disabled = computed(() => storage.value.filter((item) => enabledResourcePackNames.value.indexOf(item.id) === -1))

  const modified = computed(() => {
    if (enabledResourcePackNames.value.length !== optionsResourcePacks.value.length) {
      return true
    }
    return enabledResourcePackNames.value.every((v, i) => optionsResourcePacks.value[i] !== v)
  })

  function getResourcepackFormat(meta: any) {
    return meta ? meta.format ?? meta.pack_format : 3
  }
  function getResourcePackItem(resource: PersistedResourcePackResource): ResourcePackItem {
    const icon = isPersistedResource(resource) ? `dataroot://${resource.domain}/${resource.fileName}.png` : ''
    return ({
      path: resource.path,
      name: resource.name,
      id: `file/${basename(resource.fileName)}${resource.ext}`,
      url: resource.uri,
      pack_format: resource.metadata.pack_format,
      description: resource.metadata.description,
      acceptingRange: mappings[getResourcepackFormat(resource.metadata)] ?? '[*]',
      icon,
      tags: [...resource.tags],

      resource: (resource) as any,
    })
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
        tags: [],
      }
    }
    return storage.value.find((p) => p.id === resourcePackName || p.id === `file/${resourcePackName}`) ?? {
      path: '',
      name: resourcePackName,
      acceptingRange: 'unknown',
      icon: unknownPack,
      description: '',
      pack_format: -1,
      id: resourcePackName.startsWith('file') ? resourcePackName : `file/${resourcePackName}`,
      url: [],
      tags: [],
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
    editGameSetting({ resourcePacks: [...enabledResourcePackNames.value].reverse() })
    const modified = storage.value.filter(v => v.resource).filter((v) => v.name !== v.resource!.name || !isStringArrayEquals(v.tags, v.resource!.tags))
    for (const res of modified) {
      updateResource({ resource: res.resource!, name: res.name, tags: res.tags })
    }
  }

  watch(optionsResourcePacks, (packs) => {
    const arr = [...packs.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))]
    if (arr.indexOf('vanilla') === -1) {
      arr.unshift('vanilla')
    }
    enabledResourcePackNames.value = arr.reverse()
  })
  onMounted(() => {
    storage.value = resourceState.resourcepacks.map(getResourcePackItem)

    const arr = [...optionsResourcePacks.value.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))]
    if (arr.indexOf('vanilla') === -1) {
      arr.unshift('vanilla')
    }
    enabledResourcePackNames.value = arr.reverse()
  })

  watch(computed(() => resourceState.resourcepacks), (packs) => {
    storage.value = packs.map(getResourcePackItem)
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