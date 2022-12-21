import { useRefreshable, useService } from '@/composables'
import { isStringArrayEquals } from '@/util/equal'
import { getModDependencies, ModDependencies } from '@/util/modDependencies'
import { InstanceJavaServiceKey, InstanceModsServiceKey, InstanceServiceKey, isModResource, isPersistedResource, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { computed, InjectionKey, ref, Ref, watch } from 'vue'
import { kMods, useMods } from './mods'

export const kModsContext: InjectionKey<{
  /**
   * The current mods provided runtimes
   */
  runtime: Ref<Record<string, string>>
  /**
   * The current mdos provided icon map
   */
  icons: Ref<Record<string, string>>
}> = Symbol('ModRuntime')

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

  modLoaders: string[]

  /**
   * The resource tag
   */
  tags: string[]

  /**
   * The hash of the resource
   */
  hash: string
  /**
   * The universal location of the mod
   */
  url: string

  dependencies: ModDependencies
  provideRuntime: Record<string, string>

  /**
   * The pending enabled. Might be different from the actual enable state
   */
  enabled: boolean
  /**
   * The actual enabled state. Represent if the mod is moved to the mods folder.
   */
  enabledState: boolean

  subsequence: boolean

  selected: boolean
  dragged: boolean

  resource: Resource
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods() {
  const { state } = useService(InstanceModsServiceKey)
  const { updateResources } = useService(ResourceServiceKey)
  const { install, uninstall, showDirectory } = useService(InstanceModsServiceKey)
  const { state: javaState } = useService(InstanceJavaServiceKey)
  const { state: instanceState } = useService(InstanceServiceKey)
  const { resources, refreshing: loading } = inject(kMods, () => useMods(), true)

  const items: Ref<ModItem[]> = ref([])
  const pendingUninstallItems = computed(() => items.value.filter(i => !i.enabled && i.enabledState))
  const pendingInstallItems = computed(() => items.value.filter(i => i.enabled && !i.enabledState))
  const pendingEditItems = computed(() => items.value.filter(i => (isPersistedResource(i.resource) && !isStringArrayEquals(i.tags, i.resource.tags))))
  const isModified = computed(() => pendingInstallItems.value.length > 0 || pendingUninstallItems.value.length > 0 || pendingEditItems.value.length > 0)

  const cachedDirectory = new Map<string, ModItem>()

  const { refresh: commit, refreshing: committing } = useRefreshable(async () => {
    const promises: Promise<any>[] = []

    promises.push(updateResources(pendingEditItems.value.map(i => ({
      ...i.resource,
      name: i.name,
      tags: i.tags,
    }))))
    if (pendingInstallItems.value.length > 0) {
      promises.push(install({ mods: pendingInstallItems.value.map(v => v.resource) }))
    }
    if (pendingUninstallItems.value.length > 0) {
      promises.push(uninstall({ mods: pendingUninstallItems.value.map(v => v.resource) }))
    }

    await Promise.all(promises)
  })

  const enabledHashes = computed(() => new Set(state.mods.map(m => m.hash)))
  let enabledCache = [] as ModItem[]

  function updateEnabledMods() {
    const enabled = state.mods.map(getModItemFromResource)
    for (const item of enabled) {
      item.enabled = true
      item.enabledState = true
    }

    enabledCache = enabled
  }

  const iconMap: Ref<Record<string, string>> = ref({})
  const enabledModCounts = ref(0)

  function updateItems() {
    const enabled = enabledCache
    const enabledItemHashes = enabledHashes.value
    const disabled = resources.value.filter(res => !enabledItemHashes.has(res.hash)).map(getModItemFromModResource)

    const result = [
      ...enabled,
      ...disabled,
    ]

    const _iconMap: Record<string, string> = {}

    for (const item of result) {
      // Update icon map
      _iconMap[item.id] = item.icon

      // Update state
      const old = cachedDirectory.get(item.hash)
      if (old) {
        item.selected = old.selected
        item.dragged = old.dragged
      }
    }

    cachedDirectory.clear()
    for (const item of result) {
      cachedDirectory.set(item.hash, item)
    }

    iconMap.value = _iconMap
    items.value = result
    enabledModCounts.value = enabled.length
  }

  const currentJava = computed(() => javaState.java)

  const currentRuntime = computed(() => {
    const runtime: Record<string, string> = {
      ...(instanceState.instance.runtime as any),
      java: currentJava.value?.version.toString() ?? '',
    }
    runtime.fabricloader = runtime.fabricLoader
    for (const i of items.value) {
      if (i.enabled || i.enabledState) {
        for (const [key, val] of Object.entries(i.provideRuntime)) {
          runtime[key] = val
        }
      }
    }

    return runtime
  })

  provide(kModsContext, {
    runtime: currentRuntime,
    icons: iconMap,
  })

  watch(computed(() => state.mods), (val) => {
    updateEnabledMods()
    updateItems()
  })

  watch(resources, () => {
    updateItems()
  })

  function getUrl(resource: Resource) {
    return resource.uris.find(u => u?.startsWith('http')) ?? ''
  }
  function getModItemFromModResource(resource: Resource): ModItem {
    const isPersisted = isPersistedResource(resource)
    const dependencies = markRaw(getModDependencies(resource))
    const modItem: ModItem = ({
      path: resource.path,
      id: '',
      name: resource.path,
      version: '',
      modLoaders: markRaw([]),
      description: '',
      provideRuntime: markRaw({}),
      icon: resource.icons?.at(-1) ?? '',
      dependencies,
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: false,
      enabledState: false,
      subsequence: false,
      selected: false,
      dragged: false,
      resource,
    })
    if (resource.metadata.forge) {
      modItem.modLoaders.push('forge')
      const meta = resource.metadata.forge
      modItem.id = meta.modid
      modItem.name = meta.name
      modItem.version = meta.version
      modItem.description = meta.description
      modItem.provideRuntime[meta.modid] = meta.version
    } else if (resource.metadata.fabric) {
      const meta = resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric
      modItem.modLoaders.push('fabric')
      modItem.id = meta.id
      modItem.version = meta.version
      modItem.name = meta.name ?? meta.id
      modItem.description = meta.description ?? ''

      if (resource.metadata.fabric instanceof Array) {
        for (const mod of resource.metadata.fabric) {
          modItem.provideRuntime[mod.id] = mod.version
        }
      } else {
        modItem.provideRuntime[resource.metadata.fabric.id] = resource.metadata.fabric.version
      }
    } else if (resource.metadata.liteloader) {
      const meta = resource.metadata.liteloader
      modItem.modLoaders.push('liteloader')
      modItem.name = meta.name
      modItem.version = meta.version ?? ''
      modItem.id = `${meta.name}`
      modItem.description = modItem.description ?? ''
      modItem.provideRuntime[meta.name] = meta.version ?? ''
    } else if (resource.metadata.quilt) {
      modItem.modLoaders.push('quilt')
      const meta = resource.metadata.quilt
      modItem.id = meta.quilt_loader.id
      modItem.version = meta.quilt_loader.version
      modItem.name = meta.quilt_loader.metadata?.name ?? meta.quilt_loader.id
      modItem.description = meta.quilt_loader.metadata?.description ?? ''
      modItem.provideRuntime[meta.quilt_loader.id] = meta.quilt_loader.version
    } else {
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
    return reactive(modItem)
  }

  function getModItemFromResource(resource: Resource): ModItem {
    if (isModResource(resource)) {
      return getModItemFromModResource(resource)
    }
    const isPersisted = isPersistedResource(resource)
    return reactive({
      path: resource.path,
      id: resource.hash,
      name: resource.fileName,
      provideRuntime: {},
      modLoaders: [],
      dependencies: [],
      version: '',
      description: '',
      icon: resource.icons?.[0] || '',
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: false,
      enabledState: false,
      subsequence: false,
      hide: false,
      selected: false,
      dragged: false,
      resource: markRaw(resource),
    })
  }

  onMounted(() => {
    updateEnabledMods()
    updateItems()
  })

  return {
    isModified,
    items,
    enabledModCounts,
    commit,
    committing,
    loading,
    showDirectory,
  }
}
