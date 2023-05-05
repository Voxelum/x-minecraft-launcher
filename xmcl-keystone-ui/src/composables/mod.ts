import { useService } from '@/composables'
import { AggregateExecutor } from '@/util/aggregator'
import { ModDependencies, getModDependencies, getModProvides } from '@/util/modDependencies'
import { InstanceModsServiceKey, JavaRecord, Resource, ResourceServiceKey, RuntimeVersions, isPersistedResource } from '@xmcl/runtime-api'
import { InjectionKey, Ref, computed, ref, watch } from 'vue'

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
  /**
   * The mod description text
   */
  description: string
  /**
   * Mod icon url
   */
  icon: string
  /**
   * The mod loaders
   */
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
  /**
   * All mod dependencies
   */
  dependencies: ModDependencies
  /**
   * The provided runtime
   */
  provideRuntime: Record<string, string>
  /**
   * If this mod is enabled. This is computed from the path suffix.
   */
  enabled: boolean
  /**
   * The backed resource
   */
  resource: Resource

  // State props

  /**
   * Is this mod is selected
   */
  selected: boolean
  /**
   * Is this mod is dragged
   */
  dragged: boolean
}

/**
 * Open read/write for current instance mods
 */
export function useInstanceMods(runtimes: Ref<RuntimeVersions>, java: Ref<JavaRecord | undefined>) {
  const { state, enable, disable } = useService(InstanceModsServiceKey)
  const { updateResources } = useService(ResourceServiceKey)
  const { showDirectory } = useService(InstanceModsServiceKey)

  const items: Ref<ModItem[]> = ref([])

  const cachedItems = new Map<string, ModItem>()
  const iconMap: Ref<Record<string, string>> = ref({})
  const enabledModCounts = computed(() => items.value.filter(v => v.enabled).length)

  function updateItems(resources: Resource[]) {
    const newItems = resources.map(getModItemFromResource)
    const newIconMap: Record<string, string> = {}

    for (const item of newItems) {
      // Update icon map
      newIconMap[item.id] = item.icon

      // Update state
      const old = cachedItems.get(item.hash)
      if (old) {
        item.selected = old.selected
        item.dragged = old.dragged
      }
    }

    cachedItems.clear()
    for (const item of newItems) {
      cachedItems.set(item.hash, item)
    }

    iconMap.value = markRaw(newIconMap)
    items.value = newItems
  }

  const currentRuntime = computed(() => {
    const runtime: Record<string, string> = {
      ...(runtimes.value as any),
      java: java.value?.version.toString() ?? '',
    }
    runtime.fabricloader = runtime.fabricLoader
    for (const i of items.value) {
      if (i.enabled) {
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

  function getUrl(resource: Resource) {
    return resource.uris.find(u => u?.startsWith('http')) ?? ''
  }

  function getModItemFromResource(resource: Resource): ModItem {
    const isPersisted = isPersistedResource(resource)
    const modItem: ModItem = ({
      path: resource.path,
      id: '',
      name: resource.path,
      version: '',
      modLoaders: markRaw([]),
      description: '',
      provideRuntime: markRaw(getModProvides(resource)),
      icon: resource.icons?.at(-1) ?? '',
      dependencies: markRaw(getModDependencies(resource)),
      url: getUrl(resource),
      hash: resource.hash,
      tags: isPersisted ? [...resource.tags] : [],
      enabled: !resource.path.endsWith('.disabled'),
      selected: false,
      dragged: false,
      resource: markRaw(resource),
    })
    if (resource.metadata.forge) {
      modItem.modLoaders.push('forge')
    }
    if (resource.metadata.fabric) {
      modItem.modLoaders.push('fabric')
    }
    if (resource.metadata.liteloader) {
      modItem.modLoaders.push('liteloader')
    }
    if (resource.metadata.quilt) {
      modItem.modLoaders.push('quilt')
    }
    if (resource.metadata.forge) {
      const meta = resource.metadata.forge
      modItem.id = meta.modid
      modItem.name = meta.name
      modItem.version = meta.version
      modItem.description = meta.description
    } else if (resource.metadata.fabric) {
      const meta = resource.metadata.fabric instanceof Array ? resource.metadata.fabric[0] : resource.metadata.fabric
      modItem.id = meta.id
      modItem.version = meta.version
      modItem.name = meta.name ?? meta.id
      modItem.description = meta.description ?? ''
    } else if (resource.metadata.liteloader) {
      const meta = resource.metadata.liteloader
      modItem.name = meta.name
      modItem.version = meta.version ?? ''
      modItem.id = `${meta.name}`
      modItem.description = modItem.description ?? ''
    } else if (resource.metadata.quilt) {
      const meta = resource.metadata.quilt
      modItem.id = meta.quilt_loader.id
      modItem.version = meta.quilt_loader.version
      modItem.name = meta.quilt_loader.metadata?.name ?? meta.quilt_loader.id
      modItem.description = meta.quilt_loader.metadata?.description ?? ''
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

  const updating = ref(false)
  const executor = new AggregateExecutor<[ModItem, 'enable' | 'disable' | 'update'], [ModItem, 'enable' | 'disable' | 'update'][]>(
    (v) => v, (cmd) => {
      const toEnable = cmd.filter(c => c[1] === 'enable')
      const toDisable = cmd.filter(c => c[1] === 'disable')
      const toUpdate = cmd.filter(c => c[1] === 'update')
      Promise.all([
        enable({ mods: toEnable.map(e => e[0].resource) }),
        disable({ mods: toDisable.map(e => e[0].resource) }),
        updateResources(toUpdate.map(([item]) => ({
          ...item.resource,
          name: item.name,
          tags: item.tags,
        }))),
      ]).finally(() => {
        updating.value = false
      })
    }, 800)

  function enableMod(item: ModItem) {
    updating.value = true
    executor.push([item, 'enable'])
  }

  function disableMod(item: ModItem) {
    updating.value = true
    executor.push([item, 'disable'])
  }

  function updateTag(item: ModItem) {
    updating.value = true
    executor.push([item, 'update'])
  }

  onMounted(() => {
    updateItems(state.mods)
  })

  watch(computed(() => state.mods), (val) => {
    updateItems(val)
  })

  return {
    items,
    updating,
    enableMod,
    disableMod,
    updateTag,
    enabledModCounts,
    showDirectory,
  }
}
