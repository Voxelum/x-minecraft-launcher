import { computed, Ref } from 'vue'
import { Frame as GameSetting } from '@xmcl/gamesetting'
import { EMPTY_VERSION, getExpectVersion, getResolvedVersion, Instance, InstanceData, InstanceIOServiceKey, InstanceOptionsServiceKey, InstanceServiceKey, InstanceVersionServiceKey, ResourceServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { useServiceBusy, useSemaphore } from '@/composables/semaphore'
import { useService, useServiceOnly } from '@/composables/service'

export function useInstanceBase() {
  const { state } = useService(InstanceServiceKey)
  const path = computed(() => state.path)
  return { path }
}

export function useInstanceIsServer(i: Ref<Instance>) {
  return computed(() => i.value.server !== null)
}

/**
 * Use the general info of the instance
 */
export function useInstance() {
  const { state } = useService(InstanceServiceKey)

  const instance = computed(() => state.instance)
  const path = computed(() => state.path)
  return {
    path,
    instance,
    refreshing: computed(() => useSemaphore('instance').value !== 0),
  }
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const { state } = useService(InstanceServiceKey)
  return {
    instances: computed(() => state.instances),
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
  const quiltLoader = computed(() => state.instance.runtime.quiltLoader)
  const yarn = computed(() => state.instance.runtime.yarn)
  return {
    minecraft,
    forge,
    fabricLoader,
    quiltLoader,
    yarn,
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
    refreshing: useServiceBusy(InstanceOptionsServiceKey, 'mount'),
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
  const { state: instanceVersionState } = useService(InstanceVersionServiceKey)

  const localVersion = computed(() => instanceVersionState.versionHeader || EMPTY_VERSION)
  const folder = computed(() => localVersion.value?.id || 'unknown')

  return {
    ...useInstanceVersionBase(),
    localVersion,
    folder,
  }
}
