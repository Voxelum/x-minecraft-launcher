import { computed, ref, Ref, watch } from '@vue/composition-api'
import { FabricModMetadata } from '@xmcl/mod-parser'
import { AnyResource, Compatible, FabricResource, ForgeResource, InstanceModsServiceKey, InstanceServiceKey, isModCompatible, isModResource, isPersistedResource, LiteloaderResource, ModrinthInformation, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { useBusy, useService, useRefreshable } from '/@/composables'
import { isStringArrayEquals } from '/@/util/equal'

/**
 * Contains some basic info of mod to display in UI.
 */
export interface ModItem {
  /**
   * Path on disk
   */
  path: string
  /**
   * The mod id
   */
  id: string
  /**
   * Mod display name
   */
  name: string
  /**
   * Mod version
   */
  version: string
  description: string
  /**
   * Mod icon url
   */
  icon: string

  /**
   * The resource tag
   */
  tags: string[]

  dependencies: {
    minecraft: string
    fabricLoader?: string
    forge?: string
  }
  /**
   * The hash of the resource
   */
  hash: string
  /**
   * The universal location of the mod
   */
  url: string

  type: 'fabric' | 'forge' | 'liteloader' | 'unknown'

  compatible: Compatible

  enabled: boolean

  subsequence: boolean

  selected: boolean
  hide: boolean
  dragged: boolean

  curseforge?: {
    projectId: number
    fileId: number
  }

  modrinth?: ModrinthInformation

  resource: Resource
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods() {
  const { state } = useService(InstanceModsServiceKey)
  const { state: resourceState, updateResource } = useService(ResourceServiceKey)
  const { install, uninstall, showDirectory } = useService(InstanceModsServiceKey)
  const loading = useBusy('loadDomain(mods:resource)')
  const { state: instanceState } = useService(InstanceServiceKey)
  const items: Ref<ModItem[]> = ref([])
  const pendingUninstallItems = computed(() => items.value.filter(i => !i.enabled && cachedEnabledSet.has(i.hash)))
  const pendingInstallItems = computed(() => items.value.filter(i => i.enabled && !cachedEnabledSet.has(i.hash)))
  const pendingEditItems = computed(() => items.value.filter(i => (isPersistedResource(i.resource) && !isStringArrayEquals(i.tags, i.resource.tags))))
  const isModified = computed(() => pendingInstallItems.value.length > 0 || pendingUninstallItems.value.length > 0 || pendingEditItems.value.length > 0)

  const cachedEnabledSet = new Set<string>()
  const cachedDirectory = new Map<string, ModItem>()

  const { refresh: commit, refreshing: committing } = useRefreshable(async () => {
    const promises: Promise<any>[] = []

    for (const i of pendingEditItems.value) {
      promises.push(updateResource({
        resource: i.resource.hash,
        name: i.name,
        tags: i.tags,
      }))
    }
    if (pendingInstallItems.value.length > 0) {
      promises.push(install({ mods: pendingInstallItems.value.map(v => v.resource) }))
    }
    if (pendingUninstallItems.value.length > 0) {
      promises.push(uninstall({ mods: pendingUninstallItems.value.map(v => v.resource) }))
    }

    await Promise.all(promises)
  })

  function updateItems() {
    const enabled = state.mods.map(getModItemFromResource)
    const enabledItemHashes = new Set(state.mods.map(m => m.hash))
    const disabled = resourceState.mods.filter(res => !enabledItemHashes.has(res.hash)).map(getModItemFromModResource)
    for (const item of enabled) {
      item.enabled = true
    }

    const result = [
      ...enabled,
      ...disabled,
    ]

    for (const item of result) {
      const old = cachedDirectory.get(item.hash)
      if (old) {
        item.selected = old.selected
        item.dragged = old.dragged
      }
    }

    cachedDirectory.clear()
    cachedEnabledSet.clear()
    for (const item of result) {
      if (item.enabled) {
        cachedEnabledSet.add(item.hash)
      }
      cachedDirectory.set(item.hash, item)
    }

    items.value = result
  }

  watch(computed(() => state.mods), (val) => {
    updateItems()
  })

  watch(computed(() => resourceState.mods), (val) => {
    updateItems()
  })

  function getUrl(resource: Resource) {
    return resource.uri.find(u => u.startsWith('http')) ?? ''
  }
  function getModItemFromModResource(resource: ForgeResource | FabricResource | LiteloaderResource | AnyResource): ModItem {
    const isPersisted = isPersistedResource(resource)
    const modItem: ModItem = reactive({
      path: resource.path,
      id: '',
      name: resource.path,
      version: '',
      description: '',
      icon: isPersisted ? resource.iconUri : '',
      compatible: computed(() => isModCompatible(resource, instanceState.instance.runtime)),
      type: 'forge',
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: false,
      subsequence: false,
      hide: false,
      selected: false,
      curseforge: isPersisted ? resource.curseforge : undefined,
      modrinth: isPersisted ? resource.modrinth : undefined,
      dragged: false,
      dependencies: {
        minecraft: '',
      },
      resource,
    })
    if (resource.type === 'forge') {
      const meta = resource.metadata
      modItem.type = 'forge'
      modItem.id = meta.modid
      modItem.name = meta.name
      modItem.version = meta.version
      modItem.description = meta.description
      modItem.dependencies.minecraft = meta.acceptMinecraft
      modItem.dependencies.forge = meta.acceptForge
    } else if (resource.type === 'fabric') {
      modItem.type = 'fabric'
      modItem.id = resource.metadata.id
      modItem.version = resource.metadata.version
      modItem.name = resource.metadata.name ?? resource.metadata.id
      modItem.description = resource.metadata.description ?? ''
      const fab = resource.metadata as FabricModMetadata
      modItem.dependencies.minecraft = fab.depends?.minecraft as string ?? '?'
      modItem.dependencies.fabricLoader = fab.depends?.fabricloader as string ?? '?'
    } else if (resource.type === 'liteloader') {
      modItem.type = 'liteloader'
      modItem.name = resource.metadata.name
      modItem.version = resource.metadata.version ?? ''
      modItem.id = `${resource.metadata.name}`
      modItem.description = modItem.description ?? ''
      if (resource.metadata.mcversion) {
        modItem.dependencies.minecraft = `[${resource.metadata.mcversion}]`
      }
    } else {
      modItem.type = 'unknown'
      modItem.name = resource.fileName
    }
    if (!modItem.id) {
      modItem.id = resource.fileName + resource.hash.slice(0, 4)
    }
    if (!modItem.version) {
      modItem.version = '?'
    }
    if (!modItem.name) {
      modItem.name = resource.fileName
    }
    return modItem
  }

  function getModItemFromResource(resource: Resource): ModItem {
    if (isModResource(resource)) {
      return getModItemFromModResource(resource)
    }
    const isPersisted = isPersistedResource(resource)
    return markRaw({
      path: resource.path,
      id: resource.hash,
      name: resource.path,
      compatible: 'maybe',
      version: '',
      description: '',
      icon: '',
      type: 'unknown',
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: false,
      subsequence: false,
      hide: false,
      selected: false,
      dragged: false,
      curseforge: isPersisted ? resource.curseforge : undefined,
      modrinth: isPersisted ? resource.modrinth : undefined,
      resource,
      dependencies: { minecraft: '[*]' },
    })
  }

  onMounted(() => {
    updateItems()
  })

  return {
    isModified,
    items,
    commit,
    committing,
    loading,
    showDirectory,
  }
}
