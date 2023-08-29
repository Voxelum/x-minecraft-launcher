import { useService } from '@/composables'
import { AggregateExecutor } from '@/util/aggregator'
import { ModFile } from '@/util/mod'
import { Instance, InstanceModsServiceKey, ResourceServiceKey, isPersistedResource } from '@xmcl/runtime-api'
import { Ref, computed, ref, watch } from 'vue'

/**
 * Contains some basic info of mod to display in UI.
 */
export interface ModItem {
  mod: ModFile
  /**
   * The resource tag
   */
  tags: string[]
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
export function useInstanceModItems(instance: Ref<Instance>, mods: Ref<ModFile[]>) {
  const { enable, disable } = useService(InstanceModsServiceKey)
  const { updateResources } = useService(ResourceServiceKey)
  const { showDirectory } = useService(InstanceModsServiceKey)

  const items: Ref<ModItem[]> = ref([])
  const cachedItems = new Map<string, ModItem>()

  function updateItems(resources: ModFile[]) {
    const newItems = resources.map(getItemFromMod)

    for (const item of newItems) {
      // Update state
      const old = cachedItems.get(item.mod.hash)
      if (old) {
        item.selected = old.selected
        item.dragged = old.dragged
      }
    }

    cachedItems.clear()
    for (const item of newItems) {
      cachedItems.set(item.mod.hash, item)
    }

    items.value = newItems
  }

  function getItemFromMod(mod: ModFile): ModItem {
    const isPersisted = isPersistedResource(mod.resource)
    const modItem: ModItem = ({
      mod,
      tags: isPersisted ? [...mod.tags] : [],
      selected: false,
      dragged: false,
    })
    return reactive(modItem)
  }

  const updating = ref(false)
  const executor = new AggregateExecutor<[ModItem, 'enable' | 'disable' | 'update'], [ModItem, 'enable' | 'disable' | 'update'][]>(
    (v) => v, (cmd) => {
      const toUpdate = cmd.filter(c => c[1] === 'update')

      const enableDisableOptions: Record<string, [ModItem, 'enable' | 'disable']> = {}
      for (const [item, op] of cmd) {
        if (op === 'enable' || op === 'disable') {
          enableDisableOptions[item.mod.hash] = [item, op]
        }
      }
      const toEnable = Object.values(enableDisableOptions).filter(c => c[1] === 'enable')
      const toDisable = Object.values(enableDisableOptions).filter(c => c[1] === 'disable')

      Promise.all([
        enable({ mods: toEnable.map(e => e[0].mod.resource), path: instance.value.path }),
        disable({ mods: toDisable.map(e => e[0].mod.resource), path: instance.value.path }),
        updateResources(toUpdate.map(([item]) => ({
          ...item.mod.resource,
          name: item.mod.name,
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
    updateItems(mods.value)
  })

  watch(computed(() => mods.value), (val) => {
    updateItems(val)
  })

  return {
    items,
    updating,
    enableMod,
    disableMod,
    updateTag,
    showDirectory,
  }
}
