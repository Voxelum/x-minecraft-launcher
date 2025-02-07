import { ReactiveResourceState } from '@/util/ReactiveResourceState'
import { basename } from '@/util/basename'
import { ModFile, getModFileFromResource } from '@/util/mod'
import { CompatibleDetail, getModsCompatiblity, resolveDepsCompatible } from '@/util/modCompatible'
import { refThrottled, useEventListener } from '@vueuse/core'
import { InstanceModsServiceKey, JavaRecord, Resource, ResourceState, RuntimeVersions, SharedState } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCache } from './cache'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstanceModsContext: InjectionKey<ReturnType<typeof useInstanceMods>> = Symbol('instance-mods')

function useInstanceModsMetadataRefresh(instancePath: Ref<string>, state: Ref<SharedState<ResourceState> | undefined>) {
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
    const start = performance.now()
    const mods = await watchMods(inst)
    console.log('[instanceMods] fetch', performance.now() - start)
    mods.files = mods.files.map(m => markRaw(m))
    return mods as any
  }, ReactiveResourceState)

  const modsRaw: Ref<ModFile[]> = shallowRef([])
  const mods = refThrottled(modsRaw, 500)
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
      neoforge: runtimeVersions.neoForged ?? '',
      fabricloader: runtimeVersions.fabricLoader ?? '',
    }

    for (const item of newItems) {
      // Update icon map
      newIconMap[item.modId] = item.icon
      newIconMap[basename(item.path)] = item.icon
      if (item.enabled) {
        for (const [key, val] of Object.entries(item.provideRuntime)) {
          runtime[key] = val
        }
      }
    }

    modsIconsMap.value = markRaw(newIconMap)
    modsRaw.value = markRaw(newItems.map(markRaw))
    provideRuntime.value = markRaw(runtime)
  }

  // mod duplication detect
  const conflicted = computed(() => {
    const dict: Record<string, ModFile[]> = {}

    for (const mod of mods.value) {
      const id = mod.modId
      if (!mod.enabled) continue
      if (!dict[id]) {
        dict[id] = []
      }
      dict[id].push(mod)
    }

    // remove all the key with only one value
    for (const key in dict) {
      if (dict[key].length === 1) {
        delete dict[key]
      }
    }

    return markRaw(dict)
  })

  const compatibility = computed(() => {
    const runtime = provideRuntime.value

    const result: Record<string, CompatibleDetail[]> = {}
    for (const i of mods.value) {
      if (!i.enabled) continue
      const details = getModsCompatiblity(i.dependencies, runtime)
      result[i.modId] = details
    }

    return markRaw(result)
  })

  const incompatible = computed(() => {
    const com = compatibility.value
    for (const key in com) {
      if (!resolveDepsCompatible(com[key])) {
        return true
      }
    }
    return false
  })

  const { update: updateMetadata } = useInstanceModsMetadataRefresh(instancePath, state)
  const { t } = useI18n()

  return {
    mods,
    conflicted,
    modsIconsMap,
    provideRuntime,
    compatibility,
    incompatible,
    enabledMods,
    isValidating,
    updateMetadata,
    error: computed(() => Object.keys(conflicted.value).length ? t('mod.duplicatedDetected', { count: Object.keys(conflicted.value).length }) : error.value),
    revalidate,
  }
}
