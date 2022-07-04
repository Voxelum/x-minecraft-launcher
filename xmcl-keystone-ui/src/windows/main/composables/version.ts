import { computed, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { FabricArtifactVersion, MinecraftVersion } from '@xmcl/installer'
import { ForgeVersion, InstallServiceKey, OptifineVersion, QuiltArtifactVersion, Status, VersionServiceKey } from '@xmcl/runtime-api'
import { useService, useServiceBusy, useServiceOnly } from '/@/composables'

export function useVersions() {
  return useServiceOnly(VersionServiceKey, 'deleteVersion', 'refreshVersion', 'refreshVersions', 'showVersionDirectory', 'showVersionsDirectory')
}

export function useInstallService() {
  return useService(InstallServiceKey)
}

export function useVersionService() {
  return useService(VersionServiceKey)
}

export function useLocalVersions() {
  const { state } = useVersionService()
  const localVersions = computed(() => state.local)

  return {
    localVersions,
  }
}

export function useMinecraftVersions() {
  const { state } = useVersionService()
  const { getMinecraftVersionList } = useService(InstallServiceKey)
  const refreshing = useServiceBusy(InstallServiceKey, 'getMinecraftVersionList')
  const versions = ref([] as MinecraftVersion[])
  const release = ref(undefined as undefined | MinecraftVersion)
  const snapshot = ref(undefined as undefined | MinecraftVersion)

  const installed = computed(() => {
    const localVersions: { [k: string]: string } = {}
    for (const ver of state.local) {
      if (!ver.forge && !ver.fabric && !ver.quilt && !ver.optifine) {
        localVersions[ver.minecraft] = ver.id
      }
    }
    return localVersions
  })
  const statuses = computed(() => {
    const localVersions: { [k: string]: boolean } = {}
    state.local.forEach((ver) => {
      if (ver.minecraft) localVersions[ver.minecraft] = true
    })
    const statusMap: { [key: string]: 'local' | 'remote' } = {}
    for (const ver of versions.value) {
      statusMap[ver.id] = localVersions[ver.id] ? 'local' : 'remote'
    }
    return statusMap
  })

  const refresh = async (force = false) => {
    const result = await getMinecraftVersionList(force)
    versions.value = markRaw(result.versions)
    release.value = result.versions.find(v => v.id === result.latest.release)
    snapshot.value = result.versions.find(v => v.id === result.latest.snapshot)
  }

  return {
    installed,
    statuses,
    versions,
    refreshing,
    release,
    snapshot,
    refresh,
  }
}

export function useMinecraftVersionFilter(filterText: Ref<string>) {
  const data = reactive({
    acceptingRange: '',
    showAlpha: false,
  })

  function filter(v: MinecraftVersion) {
    if (!data.showAlpha && v.type !== 'release') return false
    // if (!isCompatible(data.acceptingRange, v.id)) return false;
    return v.id.indexOf(filterText.value) !== -1
  }

  return {
    ...toRefs(data),
    filter,
  }
}

export function useFabricVersions(minecraftVersion: Ref<string>) {
  const { getFabricVersionList } = useService(InstallServiceKey)
  const refreshing = useServiceBusy(InstallServiceKey, 'getFabricVersionList')
  const { state } = useVersionService()
  const loaderVersions = ref([] as FabricArtifactVersion[])
  const yarnVersions = ref([] as FabricArtifactVersion[])
  const installed = computed(() => {
    const locals: { [k: string]: string } = {}
    for (const ver of state.local.filter(v => v.minecraft === minecraftVersion.value)) {
      if (ver.fabric) locals[ver.fabric] = ver.id
    }
    return locals
  })
  const getStatus = (version: string) => {
    return installed.value[`${minecraftVersion.value}-${version}`] ? 'local' : 'remote'
  }
  const yarnStatus = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const locals: { [k: string]: boolean } = {}
    yarnVersions.value.forEach((v) => {
      statusMap[v.version] = locals[v.version] ? 'local' : 'remote'
    })
    return statusMap
  })

  async function refresh(force = false) {
    const result = await getFabricVersionList(force)
    loaderVersions.value = markRaw(result.loaders)
    yarnVersions.value = markRaw(result.yarns)
  }

  onMounted(() => {
    refresh()
  })

  return {
    loaderVersions,
    yarnVersions,
    refresh,
    installed,
    refreshing,
    getStatus,
    yarnStatus,
  }
}

export function useQuiltVersions(minecraftVersion: Ref<string>) {
  const { getQuiltVersionList } = useService(InstallServiceKey)
  const refreshing = useServiceBusy(InstallServiceKey, 'getQuiltVersionList')
  const { state } = useVersionService()
  const loaderVersions = ref([] as QuiltArtifactVersion[])
  const installed = computed(() => {
    const locals: { [k: string]: string} = {}
    for (const ver of state.local.filter(v => v.minecraft === minecraftVersion.value)) {
      if (ver.quilt) locals[ver.quilt] = ver.id
    }
    return locals
  })
  async function refresh(force = false) {
    const result = await getQuiltVersionList({ force, minecraftVersion: minecraftVersion.value })
    loaderVersions.value = markRaw(result)
  }

  onMounted(refresh)

  watch(minecraftVersion, () => refresh())

  return {
    installed,
    versions: loaderVersions,
    refresh,
    refreshing,
  }
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
  const { getForgeVersionList } = useInstallService()
  const { state } = useVersionService()
  const versions = ref([] as (readonly ForgeVersion[]))
  const refreshing = useServiceBusy(InstallServiceKey, 'getForgeVersionList')

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
  const installed = computed(() => {
    const localForgeVersion: { [k: string]: string } = {}
    for (const ver of state.local.filter(v => v.minecraft === minecraftVersion.value)) {
      const version = ver.forge
      localForgeVersion[version] = ver.id
      if (version) {
        const parsedVersion = version.split('-')
        if (parsedVersion.length === 3) {
          localForgeVersion[parsedVersion[1]] = ver.id
        } else if (parsedVersion.length === 2) {
          localForgeVersion[parsedVersion[1]] = ver.id
        } else if (parsedVersion.length === 1) {
          localForgeVersion[parsedVersion[0]] = ver.id
        } else {
          console.error(`Cannot resolve forge version ${ver.id}`)
        }
      }
    }
    return localForgeVersion
  })

  onMounted(() => {
    refresh()
  })

  watch(minecraftVersion, () => {
    refresh()
  })

  async function refresh(force = false) {
    if (minecraftVersion.value) {
      const result = await getForgeVersionList({ minecraftVersion: minecraftVersion.value, force })
      versions.value = markRaw(result)
    }
  }

  return {
    installed,
    versions,
    refresh,
    refreshing,
    recommended,
    latest,
  }
}

// export function useLiteloaderVersions(minecraftVersion: Ref<string>) {
//   const { getLiteloaderVersionList } = useInstallService()

//   const versions = ref([] as VersionLiteloaderSchema)
//   const refreshing = useServiceBusy(InstallServiceKey, 'getLiteloaderVersionList')
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

export function useOptifineVersions(minecraftVersion: Ref<string>, forgeVersion: Ref<string>) {
  const { getOptifineVersionList } = useInstallService()
  const { state } = useVersionService()
  const refreshing = useServiceBusy(InstallServiceKey, 'getOptifineVersionList')

  const versions = ref([] as OptifineVersion[])

  const installed = computed(() => {
    const localVersions: { [k: string]: string } = {}
    for (const ver of state.local.filter(v => v.minecraft === minecraftVersion.value && (forgeVersion.value ? forgeVersion.value === v.forge : true))) {
      if (ver.optifine) {
        localVersions[ver.optifine] = ver.id
      }
    }
    return localVersions
  })

  watch(minecraftVersion, () => {
    refresh()
  })

  onMounted(() => {
    refresh()
  })

  async function refresh(force = false) {
    const result = await getOptifineVersionList(force)
    versions.value = result.filter(v => v.mcversion === minecraftVersion.value)
  }

  return {
    installed,
    versions,
    refresh,
    refreshing,
  }
}
