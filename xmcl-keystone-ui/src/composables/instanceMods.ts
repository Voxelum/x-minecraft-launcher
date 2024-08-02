import { ModFile, getModFileFromResource } from '@/util/mod'
import { useEventListener } from '@vueuse/core'
import { InstanceModUpdatePayloadAction, InstanceModsServiceKey, InstanceModsState, JavaRecord, MutableState, PartialResourceHash, Resource, RuntimeVersions, applyUpdateToResource } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref, set } from 'vue'
import { useLocalStorageCache } from './cache'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstanceModsContext: InjectionKey<ReturnType<typeof useInstanceMods>> = Symbol('instance-mods')

function useInstanceModsMetadataRefresh(instancePath: Ref<string>, state: Ref<MutableState<InstanceModsState> | undefined>) {
  const lastUpdateMetadata = useLocalStorageCache<Record<string, number>>('instanceModsLastRefreshMetadata', () => ({}), JSON.stringify, JSON.parse)
  const { refreshMetadata } = useService(InstanceModsServiceKey)
  const expireTime = 1000 * 30 * 60 // 0.5 hour

  async function checkAndUpdate() {
    const last = lastUpdateMetadata.value[instancePath.value] || 0
    if ((Date.now() - last) > expireTime) {
      await update()
    }
  }

  async function update() {
    lastUpdateMetadata.value[instancePath.value] = Date.now()
    await refreshMetadata(instancePath.value)
  }

  const debounced = debounce(checkAndUpdate, 1000)

  watch(state, (s) => {
    if (!s) return
    s.subscribe('instanceModUpdates', () => {
      debounced()
    })
    if (s.mods.length > 0) {
      checkAndUpdate()
    }
  }, { immediate: true })

  useEventListener('focus', checkAndUpdate)

  return {
    checkAndUpdate,
    update,
  }
}

export function useInstanceMods(instancePath: Ref<string>, instanceRuntime: Ref<RuntimeVersions>, java: Ref<JavaRecord | undefined>) {
  const { watch: watchMods } = useService(InstanceModsServiceKey)
  const { isValidating, error, state, revalidate } = useState(async () => {
    const inst = instancePath.value
    if (!inst) { return undefined }
    console.time('[watchMods] ' + inst)
    const mods = await watchMods(inst)
    console.timeEnd('[watchMods] ' + inst)
    mods.mods = mods.mods.map(m => markRaw(m))
    return mods as any
  }, class extends InstanceModsState {
    override instanceModUpdates(ops: [Resource, number][]) {
      for (const o of ops) {
        markRaw(o[0])
      }
      const mods = [...this.mods]
      for (const [r, a] of ops) {
        if (a === InstanceModUpdatePayloadAction.Upsert) {
          const index = mods.findIndex(m => m?.path === r?.path || m.hash === r.hash)
          if (index === -1) {
            mods.push(r)
          } else {
            const existed = mods[index]
            if (existed.path !== r.path) {
              mods[index] = r
            } else if (process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-debugger
              console.debug(`The mod ${r.path} is already in the list!`)
            }
          }
        } else if (a === InstanceModUpdatePayloadAction.Remove) {
          const index = mods.findIndex(m => m?.path === r?.path || m.hash === r.hash)
          if (index !== -1) mods.splice(index, 1)
        } else {
          for (const update of r as any as PartialResourceHash[]) {
            for (const m of mods) {
              if (m.hash === update.hash) {
                applyUpdateToResource(m, update)
              }
            }
          }
        }
      }
      set(this, 'mods', mods)
    }
  })

  const mods: Ref<ModFile[]> = shallowRef([])
  const modsIconsMap: Ref<Record<string, string>> = shallowRef({})
  const provideRuntime: Ref<Record<string, string>> = shallowRef({})

  const enabledModCounts = computed(() => mods.value.filter(v => v.enabled).length)

  function reset() {
    mods.value = []
    modsIconsMap.value = {}
    provideRuntime.value = {}
  }
  watch(instancePath, (v, prev) => {
    if (v !== prev) {
      reset()
    }
  })
  watch([computed(() => state.value?.mods), java], () => {
    if (!state.value?.mods) {
      reset()
      return
    }
    console.log('[instanceMods] update by state')
    updateItems(state.value?.mods, instanceRuntime.value)
  })
  watch(instanceRuntime, () => {
    if (!state.value?.mods) {
      reset()
      return
    }
    console.log('[instanceMods] update by runtime')
    updateItems(state.value?.mods, instanceRuntime.value)
  }, { deep: true })

  function updateItems(resources: Resource[], runtimeVersions: RuntimeVersions) {
    const newItems = resources.map(r => getModFileFromResource(r, runtimeVersions))
    const newIconMap: Record<string, string> = {}
    const runtime: Record<string, string> = {
      ...runtimeVersions,
      java: java.value?.version.toString() ?? '',
      fabricloader: runtimeVersions.fabricLoader ?? '',
    }

    for (const item of newItems) {
      // Update icon map
      newIconMap[item.modId] = item.icon
      if (item.enabled) {
        for (const [key, val] of Object.entries(item.provideRuntime)) {
          runtime[key] = val
        }
      }
    }

    modsIconsMap.value = newIconMap
    mods.value = newItems
    provideRuntime.value = runtime
  }

  const { update: updateMetadata } = useInstanceModsMetadataRefresh(instancePath, state)

  return {
    mods,
    modsIconsMap,
    provideRuntime,
    enabledModCounts,
    isValidating,
    updateMetadata,
    error,
    revalidate,
  }
}
