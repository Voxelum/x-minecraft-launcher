import { Instance, InstanceOptionsServiceKey, InstanceResourcePacksServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref, computed, watch } from 'vue'

import { useService } from '@/composables'
import { isStringArrayEquals } from '@/util/equal'
import debounce from 'lodash.debounce'
import { InstanceResourcePack } from './instanceResourcePack'
import { isRangeCompatible } from '@/util/rangeCompatibale'

export interface ResourcePackItem {
  resourcePack: InstanceResourcePack
  name: string
  id: string
  tags: string[]
  enabled: boolean
  compatible: boolean | 'maybe'
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePackItem(instancePath: Ref<string>, minecraft: Ref<string>, enabledPacks: Ref<InstanceResourcePack[]>, disabledPacks: Ref<InstanceResourcePack[]>) {
  const { updateResources } = useService(ResourceServiceKey)
  const { editGameSetting } = useService(InstanceOptionsServiceKey)
  const { showDirectory } = useService(InstanceResourcePacksServiceKey)

  function getItemFromPack(pack: InstanceResourcePack, enabled: boolean): ResourcePackItem {
    return reactive({
      resourcePack: markRaw(pack),
      compatible: computed(() => isRangeCompatible(pack.acceptingRange ?? '', minecraft.value)),
      name: pack.name,
      id: pack.id,
      enabled,
      tags: [...pack.tags],
    })
  }

  const enabled = ref(enabledPacks.value.map(v => getItemFromPack(v, true)))
  const disabled = ref(disabledPacks.value.map(v => getItemFromPack(v, false)))

  watch(enabledPacks, (packs) => {
    enabled.value = packs.map(v => getItemFromPack(v, true))
  })
  watch(disabledPacks, (packs) => {
    disabled.value = packs.map(v => getItemFromPack(v, false))
  })

  const loading = ref(false)
  const doCommit = debounce(() => commit(), 3000)

  /**
   * Add a new resource to the enabled list
   */
  function enable(item: ResourcePackItem, to?: ResourcePackItem) {
    loading.value = true
    if (to) {
      // try to insert below
      const insertIndex = enabled.value.findIndex(m => m.resourcePack.id === to.id)
      if (insertIndex !== -1) {
        if (item.enabled) {
          // Pure reorder
          const deleteIndex = enabled.value.findIndex(m => m.resourcePack.id === item.id)
          if (deleteIndex !== -1 && enabled.value.splice(deleteIndex, 1)) {
            enabled.value.splice(insertIndex, 0, item)
            doCommit()
          }
        } else {
          // insert upper
          const deleteIndex = disabled.value.findIndex(m => m.resourcePack.id === item.id)
          if (deleteIndex !== -1 && disabled.value.splice(deleteIndex, 1)) {
            enabled.value.splice(insertIndex, 0, item)
            item.enabled = true
            doCommit()
          }
        }
      }
    } else if (!item.enabled) {
      const foundIndex = disabled.value.findIndex(m => m.resourcePack.id === item.id)
      if (foundIndex !== -1 && disabled.value.splice(foundIndex, 1)) {
        enabled.value.push(item)
        item.enabled = true
        doCommit()
      }
    }
  }

  /**
   * Remove a resource from enabled list
   */
  function disable(item: ResourcePackItem, to?: ResourcePackItem) {
    if (item.id === 'vanilla') {
      return
    }

    loading.value = true
    if (to) {
       // try to insert below
       const insertIndex = disabled.value.findIndex(m => m.resourcePack.id === to.id)
       if (insertIndex !== -1) {
          if (item.enabled) {
            // insert lower
            const deleteIndex = enabled.value.findIndex(m => m.resourcePack.id === item.id)
            if (deleteIndex !== -1 && enabled.value.splice(deleteIndex, 1)) {
              disabled.value.splice(insertIndex, 0, item)
              item.enabled = false
              doCommit()
            }
          } else {
            // Pure reorder
            const deleteIndex = disabled.value.findIndex(m => m.resourcePack.id === item.id)
            if (deleteIndex !== -1 && disabled.value.splice(deleteIndex, 1)) {
              disabled.value.splice(insertIndex, 0, item)
              doCommit()
            }
          }
       }
    } else {
      const foundIndex = enabled.value.findIndex(m => m.resourcePack.id === item.id)
      if (foundIndex !== -1 && enabled.value.splice(foundIndex, 1)) {
        disabled.value.push(item)
        item.enabled = false
        doCommit()
      }
    }
  }

  /**
   * Commit the change for current mods setting
   */
  function commit() {
    const modified = enabled.value.filter(e => e.name !== e.resourcePack.resource?.name || !isStringArrayEquals(e.tags, e.resourcePack.resource?.tags))
      .concat(disabled.value.filter(e => e.name !== e.resourcePack.resource?.name || !isStringArrayEquals(e.tags, e.resourcePack.resource?.tags)))
      .filter(v => !!v.resourcePack.resource)

    Promise.all([
      editGameSetting({ instancePath: instancePath.value, resourcePacks: [...enabled.value.map(i => i.id)].reverse() }).catch(console.error),
      updateResources(modified.map(e => ({ hash: e.resourcePack.resource!.hash, name: e.name, tags: e.tags }))).catch(console.error),
    ]).finally(() => {
      loading.value = false
    })
  }

  onUnmounted(() => {
    doCommit.flush()
  })

  return {
    showDirectory,
    enabled,
    disabled,
    enable,
    disable,
    loading,
  }
}
