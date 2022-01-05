import { computed, Data, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { Frame as GameSetting } from '@xmcl/gamesetting'
import { useBusy, useSemaphore } from './useSemaphore'
import { useService, useServiceOnly } from './useService'
import { useCurrentUser } from './useUser'
import { useMinecraftVersions } from './useVersion'
import { InstanceData, RuntimeVersions } from '/@shared/entities/instance.schema'
import { getExpectVersion } from '/@shared/entities/version'
import { InstanceOptionsServiceKey } from '../../shared/services/InstanceOptionsService'
import { InstanceIOServiceKey } from '/@shared/services/InstanceIOService'
import { InstanceLogServiceKey } from '/@shared/services/InstanceLogService'
import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions, InstanceSavesServiceKey } from '/@shared/services/InstanceSavesService'
import { InstanceServiceKey } from '/@shared/services/InstanceService'
import { InstanceVersionServiceKey } from '/@shared/services/InstanceVersionService'
import { ResourceServiceKey } from '/@shared/services/ResourceService'

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
    ...useServiceOnly(InstanceIOServiceKey, 'importInstance', 'linkInstance'),
  }
}

export function useInstanceServerEdit(server: Ref<InstanceData['server']>) {
  const result = computed({
    get: () => server.value ?? { host: '', port: undefined },
    set: (v) => { server.value = v },
  })
  return result
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
  const { gameProfile } = useCurrentUser()
  const { createAndMount: createAndSelect } = useService(InstanceServiceKey)
  const { release } = useMinecraftVersions()
  const data = reactive<InstanceData & Data>({
    name: '',
    runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '', fabricLoader: '', yarn: '' } as RuntimeVersions,
    version: '',
    java: '',
    showLog: false,
    hideLauncher: true,
    vmOptions: [] as string[],
    mcOptions: [] as string[],
    maxMemory: 0,
    minMemory: 0,
    author: gameProfile.value.name,
    description: '',
    resolution: null,
    url: '',
    icon: '',
    server: null,
  })
  const refs = toRefs(data)
  const required: Required<typeof refs> = toRefs(data) as any
  return {
    ...required,
    /**
     * Commit this creation. It will create and select the instance.
     */
    create() {
      return createAndSelect(data)
    },
    /**
     * Reset the change
     */
    reset() {
      data.name = ''
      data.runtime = {
        minecraft: release.value?.id || '',
        forge: '',
        liteloader: '',
        fabricLoader: '',
        yarn: '',
      }
      data.java = ''
      data.showLog = false
      data.hideLauncher = true
      data.vmOptions = []
      data.mcOptions = []
      data.maxMemory = 0
      data.minMemory = 0
      data.author = gameProfile.value.name
      data.description = ''
      data.resolution = null
      data.url = ''
      data.icon = ''
      data.image = ''
      data.blur = 4
      data.server = null
    },
  }
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

export function useInstanceSaves() {
  const { path } = useInstanceBase()
  const { state, cloneSave, deleteSave, exportSave, readAllInstancesSaves, importSave, mountInstanceSaves } = useService(InstanceSavesServiceKey)
  const refresh = () => mountInstanceSaves(path.value)
  return {
    refresh,
    cloneSave: (options: CloneSaveOptions) => cloneSave(options).finally(refresh),
    deleteSave: (options: DeleteSaveOptions) => deleteSave(options).finally(refresh),
    exportSave,
    readAllInstancesSaves,
    importSave: (options: ImportSaveOptions) => importSave(options).finally(refresh),
    saves: computed(() => state.saves),
  }
}

/**
 * Use references of all the version info of this instance
 */
export function useInstanceVersion() {
  const { state } = useService(InstanceVersionServiceKey)
  const { state: instanceState } = useService(InstanceServiceKey)

  const folder = computed(() => state.instanceVersion.id || 'unknown')
  const id = computed(() => getExpectVersion(instanceState.instance.runtime))

  return {
    ...useInstanceVersionBase(),
    id,
    folder,
  }
}

export function useInstanceLogs() {
  const { path } = useInstanceBase()
  return {
    path,
    ...useServiceOnly(InstanceLogServiceKey, 'getCrashReportContent', 'getLogContent', 'listCrashReports', 'listLogs', 'removeCrashReport', 'removeLog', 'showCrash', 'showLog'),
  }
}
