import { ReactiveResourceState } from '@/util/ReactiveResourceState'
import { basename } from '@/util/basename'
import { ModFile, getModFileFromResource } from '@/util/mod'
import { CompatibleDetail, getModsCompatiblity, resolveDepsCompatible } from '@/util/modCompatible'
import { refThrottled, useDebounceFn, useEventListener, useLocalStorage } from '@vueuse/core'
import { InstanceModsServiceKey, JavaRecord, ResourceState, SharedState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useResourceParseErrorNotifier } from './resourceParseError'
import { useService } from './service'
import { useState } from './syncableState'
import { RuntimeVersions } from '@xmcl/instance'
import { Resource } from '@xmcl/resource'

export const kInstanceModsContext: InjectionKey<ReturnType<typeof useInstanceMods>> = Symbol('instance-mods')

function useInstanceModsMetadataRefresh(instancePath: Ref<string>, state: Ref<SharedState<ResourceState> | undefined>) {
  const lastUpdateMetadata = useLocalStorage<Record<string, number>>('instanceModsLastRefreshMetadata', {}, { deep: false, writeDefaults: false })
  const { refreshMetadata } = useService(InstanceModsServiceKey)
  const expireTime = 1000 * 30 * 60 // 0.5 hour

  // Resource hashes already accounted for in the current instance. A file whose
  // hash is not here AND which carries no modrinth/curseforge source yet is a
  // freshly added local file (the user dropped/copied a jar in) — it must be
  // resolved right away instead of waiting out the 30-min throttle. Files that
  // already have a source (installed from market / modpack) never trigger this.
  let attempted = new Set<string>()
  let attemptedPath = ''

  function markAllAttempted() {
    attemptedPath = instancePath.value
    for (const f of state.value?.files ?? []) {
      if (f.hash) attempted.add(f.hash)
    }
  }

  async function checkAndUpdate() {
    if (attemptedPath !== instancePath.value) {
      attempted = new Set()
      markAllAttempted()
    }
    const files = state.value?.files ?? []
    const hasNewLocalFile = files.some((f) =>
      f.hash && !attempted.has(f.hash) && !f.metadata.modrinth && !f.metadata.curseforge)
    const last = lastUpdateMetadata.value[instancePath.value] || 0
    if (hasNewLocalFile || (Date.now() - last) > expireTime) {
      await update()
    }
  }

  async function update() {
    lastUpdateMetadata.value[instancePath.value] = Date.now()
    // Mark everything currently present as attempted before refreshing so the
    // `revalidate()` inside `refreshMetadata` (which re-emits `filesUpdates`)
    // doesn't loop back into another refresh.
    markAllAttempted()
    await refreshMetadata(instancePath.value)
  }

  const debounced = useDebounceFn(checkAndUpdate, 1000)

  watch(state, (s) => {
    if (!s) return
    attempted = new Set()
    markAllAttempted()
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

  useResourceParseErrorNotifier(state)

  const modsRaw: Ref<ModFile[]> = shallowRef([])
  const mods = refThrottled(modsRaw, 500)
  const modsIconsMap: Ref<Record<string, string>> = shallowRef({})
  const provideRuntime: Ref<Record<string, string>> = shallowRef({})

  const enabledMods = computed(() => mods.value.filter(v => v.enabled))

  function reset() {
    modsRaw.value = []
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
    const allows = getAllowedLoaders(runtimeVersions, newItems)

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

    allowLoaders.value = allows
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

  function getAllowedLoaders(instanceRuntime: RuntimeVersions, mods: ModFile[]) {
    const loaders = [] as string[]
    if (instanceRuntime.forge) {
      loaders.push('forge')
      if (mods.some(m => m.modId === 'fabric_api')) {
        loaders.push('fabric')
      }
    } else if (instanceRuntime.fabricLoader) {
      loaders.push('fabric')
    } else if (instanceRuntime.neoForged) {
      loaders.push('neoforge')
    } else if (instanceRuntime.quiltLoader) {
      loaders.push('quilt')
    }
    return loaders
  }

  const allowLoaders = shallowRef([] as string[])

  const compatibility = computed(() => {
    const runtime = provideRuntime.value
    const loaders = allowLoaders.value

    const result: Record<string, CompatibleDetail[]> = {}

    if (loaders.length === 0) return result

    const isForgeAndFabric = loaders[0] === 'forge' && loaders[1] === 'fabric'

    for (const i of mods.value) {
      if (!i.enabled) continue
      for (const loader of loaders) {
        const deps = i.dependencies[loader]
        if (deps) {
          const details = getModsCompatiblity(deps, runtime, isForgeAndFabric)
          result[i.modId] = details
          break
        }
      }
      if (!result[i.modId]) {
        result[i.modId] = []
      }
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
    allowLoaders,
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
