import { injection } from '@/util/inject'
import { get } from '@vueuse/core'
import type { JavaRuntimeManifest, JavaRuntimeTarget, JavaRuntimes } from '@xmcl/installer'
import { ForgeVersion, VersionMetadataService, VersionMetadataServiceEventMap, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { gt } from 'semver'
import { InjectionKey, MaybeRef, Ref, computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { useService } from './service'

async function getJson<T>(url: string) {
  const res = await fetch(url)
  if (res.ok) {
    const result = await res.json()
    return result as T
  }
  throw new Error('Failed to load ' + url)
}

interface AsyncDataResult<T> {
  data: Ref<T | undefined>
  isValidating: Ref<boolean>
  error: Ref<unknown>
  mutate: () => Promise<void>
}

/**
 * The frontend used to fan out HTTP calls through SWRV. Versions live in the
 * backend now in stale-while-revalidate mode, so the composable only needs
 * the standard `{ data, isValidating, error, mutate }` ergonomics —
 * `useAsyncData` is the minimum shim that keeps every existing `*.vue`
 * consumer working unchanged.
 *
 * The first `fetcher` call returns the cached payload immediately when one
 * is on disk; freshness updates arrive asynchronously through service
 * events (see `useServiceEvent`).
 */
function useAsyncData<T>(fetcher: () => Promise<T>): AsyncDataResult<T> {
  const data = shallowRef<T | undefined>()
  const isValidating = shallowRef(false)
  const error = shallowRef<unknown>()

  async function mutate() {
    isValidating.value = true
    error.value = undefined
    try {
      data.value = await fetcher()
    } catch (e) {
      error.value = e
    } finally {
      isValidating.value = false
    }
  }

  onMounted(() => { mutate() })

  return { data, isValidating, error, mutate }
}

/**
 * Subscribe to a typed service event for the lifetime of the current
 * component. The listener is detached on unmount so navigating away from a
 * version-input view leaves no zombie subscriptions.
 */
function useServiceEvent<K extends keyof VersionMetadataServiceEventMap>(
  service: VersionMetadataService,
  event: K,
  listener: (payload: VersionMetadataServiceEventMap[K]) => void,
) {
  onMounted(() => { service.on(event, listener) })
  onUnmounted(() => { service.removeListener(event, listener) })
}

export const kLatestMinecraftVersion: InjectionKey<ReturnType<typeof useMinecraftLatestRelease>> = Symbol('kLatestMinecraftVersion')

export function useMinecraftLatestRelease() {
  const release = shallowRef<string | undefined>()
  const snapshot = shallowRef<string | undefined>()

  function setLatestMinecraft(_release: string, _snapshot: string) {
    release.value = _release
    snapshot.value = _snapshot
  }

  return {
    release,
    snapshot,
    setLatestMinecraft,
  }
}

export function useMinecraftVersions() {
  const service = useService(VersionMetadataServiceKey)
  const { data, isValidating, error, mutate } = useAsyncData(() => service.getMinecraftVersions())

  useServiceEvent(service, 'minecraftVersions', (fresh) => { data.value = fresh })

  const { setLatestMinecraft: setLatestMinecraftVersion } = injection(kLatestMinecraftVersion)
  watch(data, (d) => {
    if (d) setLatestMinecraftVersion(d.latest.release, d.latest.snapshot)
  }, { immediate: true })

  const versions = computed(() => data.value?.versions.map(markRaw) ?? [])
  const release = computed(() => !data.value ? undefined : data.value.versions.find(v => v.id === data.value!.latest.release))
  const snapshot = computed(() => !data.value ? undefined : data.value.versions.find(v => v.id === data.value!.latest.snapshot))

  return {
    error,
    versions,
    isValidating,
    release,
    snapshot,
    mutate,
  }
}

export function useFabricVersions(minecraftVersion: Ref<string>) {
  const service = useService(VersionMetadataServiceKey)
  const { data, isValidating, error, mutate } = useAsyncData(() => service.getFabricVersions())

  useServiceEvent(service, 'fabricVersions', (fresh) => { data.value = fresh })

  const versions = computed(() => {
    if (!data.value) return []
    if (!data.value.gameVersions.includes(minecraftVersion.value)) return []
    return data.value.loaderVersions.map(markRaw)
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
  }
}

export function useLabyModManifest() {
  const service = useService(VersionMetadataServiceKey)
  const result = useAsyncData(() => service.getLabyModManifest())
  useServiceEvent(service, 'labyModManifest', (fresh) => { result.data.value = fresh })
  return result
}

export function useQuiltVersions(minecraftVersion: Ref<string>) {
  const service = useService(VersionMetadataServiceKey)
  const { data, isValidating, error, mutate } = useAsyncData(() => service.getQuiltVersions())

  useServiceEvent(service, 'quiltVersions', (fresh) => { data.value = fresh })

  const versions = computed(() => {
    if (!data.value) return []
    if (!data.value.gameVersions.includes(minecraftVersion.value)) return []
    return data.value.loaderVersions.map(markRaw)
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
  }
}

export function tryGt(a: string, b: string) {
  try {
    return gt(a, b)
  } catch {
    return false
  }
}

export function getLatestNeoforge(versions: string[]) {
  return versions.toSorted((a, b) => tryGt(a, b) ? -1 : 1)[0]
}

export function useNeoForgedVersions(minecraft: Ref<string>) {
  const service = useService(VersionMetadataServiceKey)
  const data = shallowRef<string[] | undefined>()
  const isValidating = shallowRef(false)
  const error = shallowRef<unknown>()

  async function mutate() {
    if (!minecraft.value) {
      data.value = undefined
      return
    }
    isValidating.value = true
    error.value = undefined
    try {
      data.value = await service.getNeoForgedVersions(minecraft.value)
    } catch (e) {
      error.value = e
    } finally {
      isValidating.value = false
    }
  }

  watch(minecraft, () => { mutate() }, { immediate: true })

  useServiceEvent(service, 'neoForgedVersions', (payload) => {
    if (payload.minecraft === minecraft.value) {
      data.value = payload.versions
    }
  })

  const versions = computed(() => {
    const vers = data.value
    if (!vers) return []
    return vers.toSorted((a, b) => tryGt(a, b) ? -1 : 1)
  })
  const recommended = computed(() => '')
  const latest = computed(() => versions.value[0] ?? '')

  return {
    error,
    versions,
    mutate,
    isValidating,
    recommended,
    latest,
  }
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
  const service = useService(VersionMetadataServiceKey)
  const versions = shallowRef<ForgeVersion[] | undefined>()
  const isValidating = shallowRef(false)
  const error = shallowRef<unknown>()

  async function mutate() {
    if (!minecraftVersion.value) {
      versions.value = undefined
      return
    }
    isValidating.value = true
    error.value = undefined
    try {
      versions.value = await service.getForgeVersions(minecraftVersion.value)
    } catch (e) {
      error.value = e
    } finally {
      isValidating.value = false
    }
  }

  watch(minecraftVersion, () => { mutate() }, { immediate: true })

  useServiceEvent(service, 'forgeVersions', (payload) => {
    if (payload.minecraft === minecraftVersion.value) {
      versions.value = payload.versions
    }
  })

  const recommended = computed(() => versions.value?.find(v => v.type === 'recommended'))
  const latest = computed(() => versions.value?.find(v => v.type === 'latest'))

  return {
    error,
    versions,
    mutate,
    isValidating,
    recommended,
    latest,
  }
}

export function useOptifineVersions() {
  const service = useService(VersionMetadataServiceKey)
  const { data, isValidating, error, mutate } = useAsyncData(() => service.getOptifineVersions())
  useServiceEvent(service, 'optifineVersions', (fresh) => { data.value = fresh })
  const versions = computed(() => data.value?.map(markRaw) ?? [])

  return {
    error,
    versions,
    isValidating,
    mutate,
  }
}
