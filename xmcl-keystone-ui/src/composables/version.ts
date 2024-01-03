import { useService } from '@/composables'
import { VersionMetadataServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref, computed } from 'vue'
import { kSWRVConfig } from './swrvConfig'

export function useMinecraftVersions() {
  const { getMinecraftVersionList } = useService(VersionMetadataServiceKey)

  const { data, isValidating, mutate, error } = useSWRV('/minecraft-versions',
    () => getMinecraftVersionList(),
    inject(kSWRVConfig))

  const versions = computed(() => !data.value ? [] : data.value.versions)
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
  const { getFabricVersionList } = useService(VersionMetadataServiceKey)

  const { data: allVersions, isValidating, mutate, error } = useSWRV('/fabric-versions',
    () => getFabricVersionList(),
    inject(kSWRVConfig))

  const versions = computed(() => {
    const all = allVersions.value
    if (!all) return []
    if (!all.yarns.some(v => v.gameVersion === minecraftVersion.value)) return []
    return all.loaders
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
  }
}

export function useLabyModManifest() {
  const { getLabyModManifest } = useService(VersionMetadataServiceKey)
  return useSWRV('/labymod',
    () => getLabyModManifest(),
    inject(kSWRVConfig))
}

export function useQuiltVersions(minecraftVersion: Ref<string>) {
  const { getQuiltVersionList } = useService(VersionMetadataServiceKey)

  const { data: versions, isValidating, mutate, error } = useSWRV(computed(() => `/quilt-versions/${minecraftVersion.value}`),
    () => minecraftVersion.value ? getQuiltVersionList(minecraftVersion.value).then(v => v.map(markRaw)) : [],
    inject(kSWRVConfig))

  return {
    error,
    versions,
    mutate,
    isValidating,
  }
}

export function useNeoForgedVersions(minecraft: Ref<string>) {
  const { getNeoForgedVersionList } = useService(VersionMetadataServiceKey)

  const { data, isValidating, mutate, error } = useSWRV(computed(() => `/neoforged-versions/${minecraft.value}`),
    async () => {
      const result = await getNeoForgedVersionList(minecraft.value).then(markRaw)
      return result
    },
    inject(kSWRVConfig))

  const recommended = computed(() => {
    const vers = data.value
    if (!vers) return undefined
    return vers.release
  })
  const latest = computed(() => {
    const vers = data.value
    if (!vers) return undefined
    return vers.latest
  })
  const versions = computed(() => {
    const vers = data.value
    if (!vers) return []
    return vers.versions
  })

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
  const { getForgeVersionList } = useService(VersionMetadataServiceKey)

  const { data: versions, isValidating, mutate, error } = useSWRV(computed(() => minecraftVersion.value && `/forge-versions/${minecraftVersion.value}`),
    async () => {
      console.log('forge version!')
      const version = minecraftVersion.value
      const result = version ? await getForgeVersionList(version).then(v => v.map(markRaw)) : []
      if (version !== minecraftVersion.value) {
        return []
      }
      return result
    },
    inject(kSWRVConfig))

  const recommended = computed(() => {
    const vers = versions.value
    if (!vers) return undefined
    return vers.find(v => v.type === 'recommended')
  })
  const latest = computed(() => {
    const vers = versions.value
    if (!vers) return undefined
    return vers.find(v => v.type === 'latest')
  })

  // watch(minecraftVersion, () => mutate())

  return {
    error,
    versions,
    mutate,
    isValidating,
    recommended,
    latest,
  }
}

// export function useLiteloaderVersions(minecraftVersion: Ref<string>) {
//   const { getLiteloaderVersionList } = useService(VersionMetadataServiceKey)

//   const versions = ref([] as LiteloaderVersions)
//   const refreshing = useServiceBusy(VersionMetadataServiceKey, 'getLiteloaderVersionList')
//   onMounted(() => {
//     watch(minecraftVersion, () => {
//       if (!versions.value) {
//         getLiteloaderVersionList()
//       }
//     })
//   })

//   async function refresh() {
//     await getLiteloaderVersionList()
//   }

//   return {
//     versions,
//     refresh,
//     refreshing,
//   }
// }

export function useOptifineVersions() {
  const { getOptifineVersionList } = useService(VersionMetadataServiceKey)

  const { data: allVersions, isValidating, mutate, error } = useSWRV('/optifine-versions',
    () => getOptifineVersionList().then(v => v.map(markRaw)),
    inject(kSWRVConfig))

  const versions = computed(() => allVersions.value ?? [])

  return {
    error,
    versions,
    isValidating,
    mutate,
  }
}
