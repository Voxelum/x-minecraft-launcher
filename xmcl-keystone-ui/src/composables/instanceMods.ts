import { ModFile, getModFileFromResource } from '@/util/mod'
import { InstanceModsServiceKey, InstanceModsState, JavaRecord, Resource, RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstanceModsContext: InjectionKey<ReturnType<typeof useInstanceMods>> = Symbol('instance-mods')

export function useInstanceMods(instancePath: Ref<string>, instanceRuntime: Ref<RuntimeVersions>, java: Ref<JavaRecord | undefined>) {
  const { watch: watchMods } = useService(InstanceModsServiceKey)
  const { isValidating, error, state } = useState(async () => {
    if (!instancePath.value) { return undefined }
    console.log('watch mods', instancePath.value)
    const mods = await watchMods(instancePath.value)
    mods.mods = mods.mods.map(m => markRaw(m))
    return mods as any
  }, class extends InstanceModsState {
    override instanceModUpdates(ops: [Resource, number][]) {
      console.log('instanceModUpdates', ops.length)
      for (const o of ops) {
        markRaw(o[0])
      }
      super.instanceModUpdates(ops)
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
    console.log('update instance mods by state')
    updateItems(state.value?.mods, instanceRuntime.value)
  })
  watch(instanceRuntime, () => {
    if (!state.value?.mods) {
      reset()
      return
    }
    console.log('update instance mods by runtime')
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

  return {
    mods,
    modsIconsMap,
    provideRuntime,
    enabledModCounts,
    isValidating,
    error,
  }
}
