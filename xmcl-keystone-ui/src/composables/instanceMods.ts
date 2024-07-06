import { ModFile, getModFileFromResource } from '@/util/mod'
import { InstanceModUpdatePayloadAction, InstanceModsServiceKey, InstanceModsState, JavaRecord, PartialResourceHash, Resource, RuntimeVersions, applyUpdateToResource } from '@xmcl/runtime-api'
import { InjectionKey, Ref, set } from 'vue'
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

  function revalidate() {
    state.value?.revalidate()
  }

  return {
    mods,
    modsIconsMap,
    provideRuntime,
    enabledModCounts,
    isValidating,
    error,
    revalidate,
  }
}
