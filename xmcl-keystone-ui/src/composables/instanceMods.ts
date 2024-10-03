import { ModFile, getModFileFromResource } from '@/util/mod'
import { useEventListener } from '@vueuse/core'
import { InstanceModsServiceKey, ResourceState, JavaRecord, FileUpdateOperation, FileUpdateAction, MutableState, UpdateResourcePayload, Resource, RuntimeVersions, applyUpdateToResource } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref, set } from 'vue'
import { useLocalStorageCache } from './cache'
import { useService } from './service'
import { useState } from './syncableState'
import { ReactiveResourceState } from '@/util/ReactiveResourceState'

export const kInstanceModsContext: InjectionKey<ReturnType<typeof useInstanceMods>> = Symbol('instance-mods')

function useInstanceModsMetadataRefresh(instancePath: Ref<string>, state: Ref<MutableState<ResourceState> | undefined>) {
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
    s.subscribe('filesUpdates', () => {
      debounced()
    })
    if (s.files.length > 0) {
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
    mods.files = mods.files.map(m => markRaw(m))
    return mods as any
  }, ReactiveResourceState)

  const mods: Ref<ModFile[]> = shallowRef([])
  const modsIconsMap: Ref<Record<string, string>> = shallowRef({})
  const provideRuntime: Ref<Record<string, string>> = shallowRef({})

  const enabledMods = computed(() => mods.value.filter(v => v.enabled))

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
  watch([computed(() => state.value?.files), java], () => {
    if (!state.value?.files) {
      reset()
      return
    }
    console.log('[instanceMods] update by state')
    updateItems(state.value?.files, instanceRuntime.value)
  })
  watch(instanceRuntime, () => {
    if (!state.value?.files) {
      reset()
      return
    }
    console.log('[instanceMods] update by runtime')
    updateItems(state.value?.files, instanceRuntime.value)
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
    enabledMods,
    isValidating,
    updateMetadata,
    error,
    revalidate,
  }
}
