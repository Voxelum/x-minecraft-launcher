import { filterOptfineVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary, Status } from '/@shared/entities/version'
import { isNonnull } from '/@shared/util/assert'
import { computed, onMounted, onUnmounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useBusy } from './useSemaphore'
import { useService, useServiceOnly } from './useService'
import { useStore } from './useStore'
import { InstallServiceKey } from '/@shared/services/InstallService'
import { VersionServiceKey } from '/@shared/services/VersionService'

export function useVersions() {
  return useServiceOnly(VersionServiceKey, 'deleteVersion', 'refreshVersion', 'refreshVersions', 'showVersionDirectory', 'showVersionsDirectory')
}

export function useLocalVersions() {
  const { state } = useStore()
  const localVersions = computed(() => state.version.local)
  const versions = useVersions()

  onMounted(() => {
    versions.refreshVersions()
  })

  return {
    localVersions,
    ...versions,
    ...useServiceOnly(InstallServiceKey, 'reinstall'),
  }
}

export function useMinecraftVersions() {
  const { state } = useStore()
  const { refreshMinecraft } = useService(InstallServiceKey)
  const refreshing = useBusy('refreshMinecraft')
  const versions = computed(() => state.version.minecraft.versions)
  const release = computed(() => state.version.minecraft.versions.find(v => v.id === state.version.minecraft.latest.release))
  const snapshot = computed(() => state.version.minecraft.versions.find(v => v.id === state.version.minecraft.latest.snapshot))

  const statuses = computed(() => {
    const localVersions: { [k: string]: boolean } = {}
    state.version.local.forEach((ver) => {
      if (ver.minecraftVersion) localVersions[ver.minecraftVersion] = true
    })
    const statusMap: { [key: string]: Status } = {}
    for (const ver of state.version.minecraft.versions) {
      statusMap[ver.id] = localVersions[ver.id] ? 'local' : 'remote'
    }
    return statusMap
  })

  onMounted(() => {
    refreshMinecraft()
  })

  return {
    statuses,
    versions,
    refreshing,
    release,
    snapshot,
    refresh: refreshMinecraft,
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

export function useFabricVersions() {
  const { state } = useStore()
  const { refreshFabric } = useService(InstallServiceKey)
  const loaderVersions = computed(() => state.version.fabric.loaders ?? [])
  const yarnVersions = computed(() => state.version.fabric.yarns ?? [])
  const loaderStatus = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const locals: { [k: string]: boolean } = {}
    state.version.local.forEach((ver) => {
      const lib = ver.libraries.find(isFabricLoaderLibrary)
      if (lib) locals[lib.version] = true
    })
    state.version.fabric.loaders.forEach((v) => {
      statusMap[v.version] = locals[v.version] ? 'local' : 'remote'
    })
    return statusMap
  })
  const yarnStatus = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const locals: { [k: string]: boolean } = {}
    // state.version.local.forEach((ver) => {
    //     if (ver.yarn) locals[ver.yarn] = true;
    // });
    state.version.fabric.yarns.forEach((v) => {
      statusMap[v.version] = locals[v.version] ? 'local' : 'remote'
    })
    return statusMap
  })

  function refresh(force = false) {
    return refreshFabric(force)
  }

  onMounted(() => {
    refresh()
  })

  return {
    loaderVersions,
    yarnVersions,
    refresh,
    loaderStatus,
    yarnStatus,
  }
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
  const { state } = useStore()
  const { refreshForge } = useService(InstallServiceKey)
  const versions = computed(() => state.version.forge.find(v => v.mcversion === minecraftVersion.value)?.versions ?? [])
  const refreshing = useBusy('refreshForge')

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
  const statuses = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const localForgeVersion: { [k: string]: boolean } = {}
    state.version.local.forEach((ver) => {
      const lib = ver.libraries.find(isForgeLibrary)
      if (lib) localForgeVersion[lib.version] = true
    })
    state.version.forge.forEach((container) => {
      container.versions.forEach((version) => {
        statusMap[version.version] = localForgeVersion[version.version] ? 'local' : 'remote'
      })
    })
    return statusMap
  })

  onMounted(() => {
    watch(minecraftVersion, () => {
      if (versions.value.length === 0) {
        refreshForge({ mcversion: minecraftVersion.value })
      }
    })
  })

  function refresh() {
    return refreshForge({ mcversion: minecraftVersion.value, force: true })
  }

  return {
    versions,
    refresh,
    refreshing,
    statuses,
    recommended,
    latest,
  }
}

export function useLiteloaderVersions(minecraftVersion: Ref<string>) {
  const { state } = useStore()
  const { refreshLiteloader } = useService(InstallServiceKey)

  const versions = computed(() => Object.values(state.version.liteloader.versions[minecraftVersion.value] || {}).filter(isNonnull))
  const refreshing = useBusy('refreshLiteloader')
  onMounted(() => {
    watch(minecraftVersion, () => {
      if (!versions.value) {
        refreshLiteloader()
      }
    })
  })

  function refresh() {
    return refreshLiteloader()
  }

  return {
    versions,
    refresh,
    refreshing,
  }
}

export function useOptifineVersions(minecraftVersion: Ref<string>) {
  const { state } = useStore()
  const { refreshOptifine } = useService(InstallServiceKey)

  const versions = computed(() => state.version.optifine.versions.filter(v => v.mcversion === minecraftVersion.value))
  const refreshing = useBusy('refreshOptifine')

  const statuses = computed(() => {
    const localVersions: { [k: string]: boolean } = {}
    state.version.local.forEach((ver) => {
      const lib = ver.libraries.find(isOptifineLibrary)
      if (lib) {
        const optifineVer = filterOptfineVersion(lib?.version)
        localVersions[`${ver.minecraftVersion}_${optifineVer}`] = true
      }
    })
    const statusMap: { [key: string]: Status } = {}
    for (const ver of state.version.optifine.versions) {
      const optifineVersion = ver.mcversion + '_' + ver.type + '_' + ver.patch
      statusMap[optifineVersion] = localVersions[optifineVersion] ? 'local' : 'remote'
    }
    return statusMap
  })

  watch(minecraftVersion, () => {
    refreshOptifine()
  })

  function refresh() {
    return refreshOptifine()
  }

  return {
    statuses,
    versions,
    refresh,
    refreshing,
  }
}
