import { computed, ref, Ref, watch } from 'vue'
import { FabricModMetadata } from '@xmcl/mod-parser'
import { Compatible, DepsCompatible, getModCompatibility, InstanceJavaServiceKey, InstanceModsServiceKey, InstanceServiceKey, isModCompatible, isModResource, isPersistedResource, resolveDepsCompatible, Resource, ResourceDomain, ResourceServiceKey, ResourceSourceModrinth } from '@xmcl/runtime-api'
import { useRefreshable, useService, useServiceBusy } from '@/composables'
import { isStringArrayEquals } from '@/util/equal'

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

  provideRuntime: Record<string, string>
  /**
   * The hash of the resource
   */
  hash: string
  /**
   * The universal location of the mod
   */
  url: string

  type: 'fabric' | 'forge' | 'liteloader' | 'quilt' | 'unknown'

  compatible: Compatible

  compatibility: DepsCompatible

  dependenciesIcon: Record<string, string>
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
  hide: boolean
  dragged: boolean

  curseforge?: {
    projectId: number
    fileId: number
  }

  modrinth?: ResourceSourceModrinth

  resource: Resource
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods() {
  const { state } = useService(InstanceModsServiceKey)
  const { state: resourceState, updateResources } = useService(ResourceServiceKey)
  const { install, uninstall, showDirectory } = useService(InstanceModsServiceKey)
  const { state: javaState } = useService(InstanceJavaServiceKey)
  const loading = useServiceBusy(ResourceServiceKey, 'load', ResourceDomain.Mods)
  const { state: instanceState } = useService(InstanceServiceKey)
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

  function updateItems() {
    const enabled = state.mods.map(getModItemFromResource)
    const enabledItemHashes = new Set(state.mods.map(m => m.hash))
    const disabled = resourceState.mods.filter(res => !enabledItemHashes.has(res.hash)).map(getModItemFromModResource)
    for (const item of enabled) {
      item.enabled = true
      item.enabledState = true
    }

    const result = [
      ...enabled,
      ...disabled,
    ]

    const iconMap: Record<string, string> = {}
    for (const item of result) {
      // Update icon map
      iconMap[item.id] = item.icon

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

    for (const item of result) {
      for (const [id, entry] of Object.entries(item.compatibility)) {
        item.dependenciesIcon[id] = iconMap[id]
      }
    }

    items.value = result
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

  watch(computed(() => state.mods), (val) => {
    updateItems()
  })

  watch(computed(() => resourceState.mods), (val) => {
    updateItems()
  })

  function getUrl(resource: Resource) {
    return resource.uri.find(u => u?.startsWith('http')) ?? ''
  }
  function getModItemFromModResource(resource: Resource): ModItem {
    const isPersisted = isPersistedResource(resource)
    const compatibility = computed(() => getModCompatibility(resource, currentRuntime.value))
    const isCompatible = computed(() => resolveDepsCompatible(compatibility.value))
    const modItem: ModItem = reactive({
      path: resource.path,
      id: '',
      name: resource.path,
      version: '',
      description: '',
      provideRuntime: {},
      icon: resource.icons?.[0] ?? '',
      compatibility,
      compatible: isCompatible,
      dependenciesIcon: {},
      type: 'unknown',
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: false,
      enabledState: false,
      subsequence: false,
      hide: false,
      selected: false,
      curseforge: resource.metadata.curseforge,
      modrinth: resource.metadata.modrinth,
      dragged: false,
      dependencies: {
        minecraft: '',
      },
      resource,
    })
    if (resource.metadata.forge) {
      const meta = resource.metadata.forge
      modItem.type = 'forge'
      modItem.id = meta.modid
      modItem.name = meta.name
      modItem.version = meta.version
      modItem.description = meta.description
      modItem.provideRuntime[meta.modid] = meta.version
    } else if (resource.metadata.fabric) {
      const meta = resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric
      modItem.type = 'fabric'
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
      modItem.type = 'liteloader'
      modItem.name = meta.name
      modItem.version = meta.version ?? ''
      modItem.id = `${meta.name}`
      modItem.description = modItem.description ?? ''
      modItem.provideRuntime[meta.name] = meta.version ?? ''
    } else if (resource.metadata.quilt) {
      const meta = resource.metadata.quilt
      modItem.type = 'quilt'
      modItem.id = meta.quilt_loader.id
      modItem.version = meta.quilt_loader.version
      modItem.name = meta.quilt_loader.metadata?.name ?? meta.quilt_loader.id
      modItem.description = meta.quilt_loader.metadata?.description ?? ''
      modItem.provideRuntime[meta.quilt_loader.id] = meta.quilt_loader.version
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
    return reactive({
      path: resource.path,
      id: resource.hash,
      name: resource.fileName,
      provideRuntime: {},
      compatible: 'maybe',
      compatibility: {},
      dependenciesIcon: {},
      version: '',
      description: '',
      icon: resource.icons?.[0] || '',
      type: 'unknown',
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: false,
      enabledState: false,
      subsequence: false,
      hide: false,
      selected: false,
      dragged: false,
      curseforge: resource.metadata.curseforge,
      modrinth: resource.metadata.modrinth,
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
