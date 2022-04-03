import { computed, Ref } from '@vue/composition-api'
import { Frame as GameSetting } from '@xmcl/gamesetting'
import { getExpectVersion, getResolvedVersion, ImportSaveOptions, InstanceData, InstanceIOServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey, InstanceServiceKey, ResourceServiceKey, RuntimeVersions, VersionServiceKey } from '@xmcl/runtime-api'
import { useBusy, useSemaphore } from '/@/composables/semaphore'
import { useService, useServiceOnly } from '/@/composables/service'

export function useInstanceBase() {
  const { state } = useService(InstanceServiceKey)
  const path = computed(() => state.path)
  return { path }
}

/**
 * Use the general info of the instance
 */
export function useInstance() {
  const { state, editInstance } = useService(InstanceServiceKey)

  const path = computed(() => state.path)
  const name = computed(() => state.instance.name)
  const author = computed(() => state.instance.author)
  const description = computed(() => state.instance.description)
  const modpackVersion = computed(() => state.instance.modpackVersion)
  const fileApi = computed(() => state.instance.fileApi)
  const showLog = computed(() => state.instance.showLog)
  const hideLauncher = computed(() => state.instance.hideLauncher)
  const runtime = computed(() => state.instance.runtime)
  const java = computed(() => state.instance.java)
  const resolution = computed(() => state.instance.resolution)
  const minMemory = computed(() => state.instance.minMemory)
  const maxMemory = computed(() => state.instance.maxMemory)
  const vmOptions = computed(() => state.instance.vmOptions)
  const mcOptions = computed(() => state.instance.mcOptions)
  const url = computed(() => state.instance.url)
  const icon = computed(() => state.instance.icon)
  const lastAccessDate = computed(() => state.instance.lastAccessDate)
  const creationDate = computed(() => state.instance.creationDate)
  const server = computed(() => state.instance.server)
  const version = computed(() => state.instance.version)
  return {
    path,
    name,
    author,
    description,
    showLog,
    hideLauncher,
    runtime,
    version,
    java,
    resolution,
    minMemory,
    maxMemory,
    vmOptions,
    mcOptions,
    url,
    icon,
    lastAccessDate,
    creationDate,
    server,
    modpackVersion,
    fileApi,
    isServer: computed(() => state.instance.server !== null),
    refreshing: computed(() => useSemaphore('instance').value !== 0),
    editInstance,
    ...useServiceOnly(InstanceIOServiceKey, 'exportInstance'),
  }
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const { state } = useService(InstanceServiceKey)
  return {
    instances: computed(() => state.instances),
    ...useServiceOnly(InstanceServiceKey, 'mountInstance', 'deleteInstance'),
    ...useServiceOnly(InstanceIOServiceKey, 'importInstance'),
  }
}

export function useInstanceServerEdit(server: Ref<InstanceData['server']>) {
  const result = computed({
    get: () => server.value ?? { host: '', port: undefined },
    set: (v) => { server.value = v },
  })
  return result
}

export function useInstanceVersionBase() {
  const { state } = useService(InstanceServiceKey)
  const minecraft = computed(() => state.instance.runtime.minecraft)
  const forge = computed(() => state.instance.runtime.forge)
  const fabricLoader = computed(() => state.instance.runtime.fabricLoader)
  const yarn = computed(() => state.instance.runtime.yarn)
  return {
    minecraft,
    forge,
    fabricLoader,
    yarn,
  }
}

export function useInstanceTemplates() {
  const { state } = useService(InstanceServiceKey)
  const { state: resourceState } = useService(ResourceServiceKey)
  return {
    instances: computed(() => state.instances),
    modpacks: computed(() => resourceState.modpacks),
  }
}

export function useInstanceGameSetting() {
  const { state, refresh: _refresh, editGameSetting: edit, showOptionsFileInFolder: showInFolder } = useService(InstanceOptionsServiceKey)
  const refresh = () => _refresh()
  const fancyGraphics = computed(() => state.options.fancyGraphics)
  const renderClouds = computed(() => state.options.renderClouds)
  const ao = computed(() => state.options.ao)
  const entityShadows = computed(() => state.options.entityShadows)
  // const particles = computed(() => state.options.particles)
  // const mipmapLevels = computed(() => state.options.mipmapLevels)
  const useVbo = computed(() => state.options.useVbo)
  const fboEnable = computed(() => state.options.fboEnable)
  const enableVsync = computed(() => state.options.enableVsync)
  const anaglyph3d = computed(() => state.options.anaglyph3d)

  return {
    fancyGraphics,
    renderClouds,
    ao,
    entityShadows,
    // particles,
    // mipmapLevels,
    useVbo,
    fboEnable,
    enableVsync,
    anaglyph3d,
    showInFolder,
    refreshing: useBusy('loadInstanceGameSettings'),
    refresh,
    commit(settings: GameSetting) {
      edit(settings)
    },
  }
}

/**
 * Use references of all the version info of this instance
 */
export function useInstanceVersion() {
  const { state: versionState } = useService(VersionServiceKey)
  const { state: instanceState } = useService(InstanceServiceKey)
  const { runtime, version } = useInstance()

  const id = computed(() => getExpectVersion(instanceState.instance.runtime))
  const localVersion = computed(() => getResolvedVersion(versionState.local, runtime.value, version.value))
  const folder = computed(() => localVersion.value.id || 'unknown')

  return {
    ...useInstanceVersionBase(),
    localVersion,
    id,
    folder,
  }
}
