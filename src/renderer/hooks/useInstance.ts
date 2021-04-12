import { computed, reactive, toRefs } from '@vue/composition-api'
import { Frame as GameSetting } from '@xmcl/gamesetting'
import { useBusy, useSemaphore } from './useSemaphore'
import { useService, useServiceOnly } from './useService'
import { useStore } from './useStore'
import { useCurrentUser } from './useUser'
import { useMinecraftVersions } from './useVersion'
import { InstanceSchema as InstanceConfig, RuntimeVersions } from '/@shared/entities/instance.schema'
import { CurseforgeModpackResource, ModpackResource } from '/@shared/entities/resource'
import { ResourceType } from '/@shared/entities/resource.schema'
import { getExpectVersion } from '/@shared/entities/version'
import { InstanceGameSettingServiceKey } from '/@shared/services/InstanceGameSettingService'
import { InstanceIOServiceKey } from '/@shared/services/InstanceIOService'
import { InstanceLogServiceKey } from '/@shared/services/InstanceLogService'
import { CloneSaveOptions, DeleteSaveOptions, ImportSaveOptions, InstanceSavesServiceKey } from '/@shared/services/InstanceSavesService'
import { CreateOption, InstanceServiceKey } from '/@shared/services/InstanceService'

export function useInstanceBase() {
  const { state } = useStore()
  const path = computed(() => state.instance.path)
  return { path }
}

/**
 * Use the general info of the instance
 */
export function useInstance() {
  const { getters, state } = useStore()

  const path = computed(() => state.instance.path)
  const name = computed(() => getters.instance.name)
  const author = computed(() => getters.instance.author || '')
  const description = computed(() => getters.instance.description)
  const showLog = computed(() => getters.instance.showLog)
  const hideLauncher = computed(() => getters.instance.hideLauncher)
  const runtime = computed(() => getters.instance.runtime)
  const java = computed(() => getters.instance.java)
  const resolution = computed(() => getters.instance.resolution)
  const minMemory = computed(() => getters.instance.minMemory)
  const maxMemory = computed(() => getters.instance.maxMemory)
  const vmOptions = computed(() => getters.instance.vmOptions)
  const mcOptions = computed(() => getters.instance.mcOptions)
  const url = computed(() => getters.instance.url)
  const icon = computed(() => getters.instance.icon)
  const lastAccessDate = computed(() => getters.instance.lastAccessDate)
  const creationDate = computed(() => getters.instance.creationDate)
  const server = computed(() => getters.instance.server)
  const version = computed(() => getters.instance.version)
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
    isServer: computed(() => getters.instance.server !== null),
    refreshing: computed(() => useSemaphore('instance').value !== 0),
    ...useServiceOnly(InstanceServiceKey, 'editInstance', 'refreshServerStatus'),
    ...useServiceOnly(InstanceIOServiceKey, 'exportInstance'),
  }
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const { getters } = useStore()
  return {
    instances: computed(() => getters.instances),

    ...useServiceOnly(InstanceServiceKey, 'mountInstance', 'deleteInstance', 'refreshServerStatusAll'),
    ...useServiceOnly(InstanceIOServiceKey, 'importInstance', 'linkInstance'),
  }
}

/**
 * Hook to create a general instance
 */
export function useInstanceCreation() {
  const { gameProfile } = useCurrentUser()
  const { createAndMount: createAndSelect } = useService(InstanceServiceKey)
  const { release } = useMinecraftVersions()
  const data = reactive({
    name: '',
    runtime: { forge: '', minecraft: release.value?.id || '', liteloader: '', fabricLoader: '', yarn: '' } as RuntimeVersions,
    java: '',
    showLog: false,
    hideLauncher: true,
    vmOptions: [] as string[],
    mcOptions: [] as string[],
    maxMemory: undefined as undefined | number,
    minMemory: undefined as undefined | number,
    author: gameProfile.value.name,
    description: '',
    resolution: undefined as undefined | CreateOption['resolution'],
    url: '',
    icon: '',
    image: '',
    blur: 4,
    server: null as undefined | CreateOption['server'],
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
      data.maxMemory = undefined
      data.minMemory = undefined
      data.author = gameProfile.value.name
      data.description = ''
      data.resolution = undefined
      data.url = ''
      data.icon = ''
      data.image = ''
      data.blur = 4
      data.server = null
    },
    /**
     * Use the same configuration as the input instance
     * @param instance The instance will be copied
     */
    use(instance: InstanceConfig) {
      data.name = instance.name
      data.runtime = { ...instance.runtime }
      data.java = instance.java
      data.showLog = instance.showLog
      data.hideLauncher = instance.hideLauncher
      data.vmOptions = [...instance.vmOptions]
      data.mcOptions = [...instance.mcOptions]
      data.maxMemory = instance.maxMemory
      data.minMemory = instance.minMemory
      data.author = instance.author
      data.description = instance.description
      data.url = instance.url
      data.icon = instance.icon
      data.server = instance.server ? { ...instance.server } : undefined
    },

    useModpack(resource: CurseforgeModpackResource | ModpackResource) {
      if (resource.type === ResourceType.CurseforgeModpack) {
        const metadata = resource.metadata
        data.name = `${metadata.name} - ${metadata.version}`
        data.runtime.minecraft = metadata.minecraft.version
        if (metadata.minecraft.modLoaders.length > 0) {
          for (const loader of metadata.minecraft.modLoaders) {
            if (loader.id.startsWith('forge-')) {
              data.runtime.forge = loader.id.substring('forge-'.length)
            }
          }
        }
        data.author = metadata.author
      } else {
        const metadata = resource.metadata
        data.name = resource.name
        data.runtime.minecraft = metadata.runtime.minecraft
        data.runtime.forge = metadata.runtime.forge
        data.runtime.fabricLoader = metadata.runtime.fabricLoader
      }
    },
  }
}

export function useInstanceVersionBase() {
  const { getters } = useStore()
  const minecraft = computed(() => getters.instance.runtime.minecraft)
  const forge = computed(() => getters.instance.runtime.forge)
  const fabricLoader = computed(() => getters.instance.runtime.fabricLoader)
  const yarn = computed(() => getters.instance.runtime.yarn)
  return {
    minecraft,
    forge,
    fabricLoader,
    yarn,
  }
}

export function useInstanceTemplates() {
  const { getters, state } = useStore()
  return {
    instances: computed(() => getters.instances),
    modpacks: computed(() => state.resource.modpacks),
  }
}

export function useInstanceGameSetting() {
  const { state } = useStore()
  const { refresh: _refresh, edit, showInFolder } = useService(InstanceGameSettingServiceKey)
  const refresh = () => _refresh()
  const fancyGraphics = computed(() => state.instanceGameSetting.fancyGraphics)
  const renderClouds = computed(() => state.instanceGameSetting.renderClouds)
  const ao = computed(() => state.instanceGameSetting.ao)
  const entityShadows = computed(() => state.instanceGameSetting.entityShadows)
  const particles = computed(() => state.instanceGameSetting.particles)
  const mipmapLevels = computed(() => state.instanceGameSetting.mipmapLevels)
  const useVbo = computed(() => state.instanceGameSetting.useVbo)
  const fboEnable = computed(() => state.instanceGameSetting.fboEnable)
  const enableVsync = computed(() => state.instanceGameSetting.enableVsync)
  const anaglyph3d = computed(() => state.instanceGameSetting.anaglyph3d)

  return {
    fancyGraphics,
    renderClouds,
    ao,
    entityShadows,
    particles,
    mipmapLevels,
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
  const { state } = useStore()
  const { cloneSave, deleteSave, exportSave, readAllInstancesSaves, importSave, mountInstanceSaves } = useService(InstanceSavesServiceKey)
  const refresh = () => mountInstanceSaves(state.instance.path)
  return {
    refresh,
    cloneSave: (options: CloneSaveOptions) => cloneSave(options).finally(refresh),
    deleteSave: (options: DeleteSaveOptions) => deleteSave(options).finally(refresh),
    exportSave,
    readAllInstancesSaves,
    importSave: (options: ImportSaveOptions) => importSave(options).finally(refresh),
    path: computed(() => state.instance.path),
    saves: computed(() => state.instanceSave.saves),
  }
}

/**
 * Use references of all the version info of this instance
 */
export function useInstanceVersion() {
  const { getters } = useStore()

  const folder = computed(() => getters.instanceVersion.id || 'unknown')
  const id = computed(() => getExpectVersion(getters.instance.runtime))

  return {
    ...useInstanceVersionBase(),
    id,
    folder,
  }
}

export function useInstanceLogs() {
  const { state } = useStore()
  return {
    path: computed(() => state.instance.path),
    ...useServiceOnly(InstanceLogServiceKey, 'getCrashReportContent', 'getLogContent', 'listCrashReports', 'listLogs', 'removeCrashReport', 'removeLog', 'showCrash', 'showLog'),
  }
}
