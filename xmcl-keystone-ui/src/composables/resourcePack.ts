import { PackMeta } from '@xmcl/resourcepack'
import { InstanceOptionsServiceKey, InstanceResourcePacksServiceKey, isPersistedResource, packFormatVersionRange, Persisted, Resource, ResourcePackResource, ResourceServiceKey } from '@xmcl/runtime-api'
import { computed, onMounted, ref, Ref, watch } from 'vue'

import unknownPack from '@/assets/unknown_pack.png'
import { useService, useServiceBusy } from '@/composables'
import { isStringArrayEquals } from '@/util/equal'
import { kResourcePacks, useResourcePacks } from './resourcePacks'
import { injection } from '@/util/inject'
import { kInstanceContext } from './instanceContext'

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
  resource?: Persisted<ResourcePackResource>
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks() {
  const { options: { state: options }, path } = injection(kInstanceContext)
  const { editGameSetting } = useService(InstanceOptionsServiceKey)
  const { resources, refreshing } = inject(kResourcePacks, () => useResourcePacks(), true)
  const { updateResources } = useService(ResourceServiceKey)
  const { showDirectory } = useService(InstanceResourcePacksServiceKey)
  const { t } = useI18n()

  const editing = useServiceBusy(InstanceOptionsServiceKey, 'editGameSetting')
  const loading = computed(() => editing.value || refreshing.value)
  /**
   * The resource pack name array.
   * It's the REVERSED version of the resourcePacks array in options.txt (gamesetting).
   * It should be something like ['file/pack.zip', 'vanilla']
   */
  const enabledResourcePackNames: Ref<string[]> = ref([])
  const optionsResourcePacks = computed(() => options.value?.options.resourcePacks || [])
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
  function getResourcePackItem(resource: Resource): ResourcePackItem {
    if (resource.metadata.resourcepack) {
      return ({
        path: resource.path,
        name: resource.name,
        id: `file/${resource.fileName.endsWith('.zip') ? resource.fileName : resource.fileName + '.zip'}`,
        url: resource.uris,
        pack_format: resource.metadata.resourcepack.pack_format,
        description: resource.metadata.resourcepack.description,
        acceptingRange: packFormatVersionRange[getResourcepackFormat(resource.metadata.resourcepack)] ?? '[*]',
        icon: isPersistedResource(resource) ? resource.icons?.[0] ?? '' : '',
        tags: [...resource.tags],

        resource: (resource) as any,
      })
    } else {
      console.log('bad resource')
      console.log(resource)
      return {
        path: resource.path,
        name: resource.name,
        id: `file/${resource.fileName.endsWith('.zip') ? resource.fileName : resource.fileName + '.zip'}`,
        url: resource.uris,
        pack_format: 0,
        description: '',
        acceptingRange: packFormatVersionRange[getResourcepackFormat(resource.metadata)] ?? '[*]',
        icon: isPersistedResource(resource) ? resource.icons?.[0] ?? '' : '',
        tags: [...resource.tags],

        resource: (resource) as any,
      }
    }
  }
  function getResourcePackItemFromGameSettingName(resourcePackName: string): ResourcePackItem {
    if (resourcePackName === 'vanilla') {
      return {
        path: '',
        acceptingRange: '[*]',
        icon: unknownPack,
        name: t('resourcepack.defaultName'),
        description: t('resourcepack.defaultDescription'),
        pack_format: 0,
        id: 'vanilla',
        url: [],
        tags: [],
      }
    }
    return storage.value.find((p) => p.id === resourcePackName || p.id === `file/${resourcePackName}`) ?? {
      path: `file/${resourcePackName}`,
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
    editGameSetting({ instancePath: path.value, resourcePacks: [...enabledResourcePackNames.value].reverse() })
    const modified = storage.value.filter(v => v.resource).filter((v) => v.name !== v.resource!.name || !isStringArrayEquals(v.tags, v.resource!.tags))
    updateResources(modified.map(res => ({ ...res.resource!, name: res.name, tags: res.tags })))
  }

  watch(optionsResourcePacks, (packs) => {
    const arr = [...packs.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))]
    if (arr.indexOf('vanilla') === -1) {
      arr.unshift('vanilla')
    }
    enabledResourcePackNames.value = arr.reverse()
  })
  onMounted(() => {
    storage.value = resources.value.map(getResourcePackItem)

    const arr = [...optionsResourcePacks.value.map((p) => ((p === 'vanilla' || p.startsWith('file/')) ? p : `file/${p}`))]
    if (arr.indexOf('vanilla') === -1) {
      arr.unshift('vanilla')
    }
    enabledResourcePackNames.value = arr.reverse()
  })

  watch(resources, (packs) => {
    storage.value = packs.map(getResourcePackItem)
  })

  return {
    showDirectory,
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
