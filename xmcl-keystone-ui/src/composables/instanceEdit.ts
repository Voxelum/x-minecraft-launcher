import { InjectionKey } from 'vue'
import { BaseServiceKey, InstanceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { useService } from '@/composables'

export const InstanceEditInjectionKey: InjectionKey<ReturnType<typeof useInstanceEdit>> = Symbol('InstanceEdit')

export function useInstanceEdit() {
  const { state, editInstance: edit } = useService(InstanceServiceKey)
  const { state: baseState } = useService(BaseServiceKey)
  const instance = computed(() => state.instances.find(s => s.path === state.path))

  const data = reactive({
    name: instance.value?.name ?? '',

    host: '', // mc.hypixel.com
    port: '', // 25565

    author: '',
    description: '',
    url: '',
    fileServerApi: '',

    vmOptions: instance.value?.vmOptions?.join(' '),
    mcOptions: instance.value?.mcOptions?.join(' '),
    maxMemory: instance.value?.maxMemory,
    minMemory: instance.value?.minMemory,

    runtime: {
      minecraft: '',
      forge: instance.value?.runtime.forge,
      fabricLoader: instance.value?.runtime.fabricLoader,
      quiltLoader: instance.value?.runtime.quiltLoader,
      optifine: instance.value?.runtime.optifine,
      liteloader: instance.value?.runtime.liteloader,
    } as RuntimeVersions,
    version: '',

    fastLaunch: instance.value?.fastLaunch,
    hideLauncher: instance.value?.hideLauncher,
    showLog: instance.value?.showLog,

    assignMemory: instance.value?.assignMemory,

    javaPath: instance.value?.java,

    loading: true,
  })

  const isGlobalAssignMemory = computed(() => data.assignMemory === undefined)
  const isGlobalMinMemory = computed(() => data.minMemory === undefined)
  const isGlobalMaxMemory = computed(() => data.maxMemory === undefined)
  const isGlobalVmOptions = computed(() => !data.vmOptions)
  const isGlobalMcOptions = computed(() => !data.mcOptions)
  const isGlobalFastLaunch = computed(() => data.fastLaunch === undefined)
  const isGlobalHideLauncher = computed(() => data.hideLauncher === undefined)
  const isGlobalShowLog = computed(() => data.showLog === undefined)
  const resetAssignMemory = () => {
    data.assignMemory = undefined
    data.minMemory = undefined
    data.maxMemory = undefined
  }
  const resetVmOptions = () => {
    data.vmOptions = undefined
  }
  const resetMcOptions = () => {
    data.mcOptions = undefined
  }
  const resetFastLaunch = () => {
    data.fastLaunch = undefined
  }
  const resetHideLauncher = () => {
    data.hideLauncher = undefined
  }
  const resetShowLog = () => {
    data.showLog = undefined
  }

  const assignMemory = computed({
    get: () => data.assignMemory ?? baseState.globalAssignMemory,
    set: (v) => { data.assignMemory = v },
  })
  const minMemory = computed({
    get: () => data.minMemory ?? baseState.globalMinMemory,
    set: (v) => { data.minMemory = v },
  })
  const maxMemory = computed({
    get: () => data.maxMemory ?? baseState.globalMaxMemory,
    set: (v) => { data.maxMemory = v },
  })
  const vmOptions = computed({
    get: () => data.vmOptions || baseState.globalVmOptions.join(' '),
    set: (v) => { data.vmOptions = v },
  })
  const mcOptions = computed({
    get: () => data.mcOptions || baseState.globalMcOptions.join(' '),
    set: (v) => { data.mcOptions = v },
  })
  const fastLaunch = computed({
    get: () => data.fastLaunch || baseState.globalFastLaunch,
    set: (v) => { data.fastLaunch = v },
  })
  const hideLauncher = computed({
    get: () => data.hideLauncher || baseState.globalHideLauncher,
    set: (v) => { data.hideLauncher = v },
  })
  const showLog = computed({
    get: () => data.showLog || baseState.globalShowLog,
    set: (v) => { data.showLog = v },
  })

  async function save() {
    const payload = {
      name: data.name,
      url: data.url,
      fileApi: data.fileServerApi,
      minMemory: data.minMemory,
      maxMemory: data.maxMemory,
      vmOptions: data.vmOptions?.split(' ').filter(v => v.length !== 0) || [],
      mcOptions: data.mcOptions?.split(' ').filter(v => v.length !== 0) || [],
      assignMemory: data.assignMemory,
      version: data.version,
      runtime: data.runtime,
      fastLaunch: data.fastLaunch,
      showLog: data.showLog,
      hideLauncher: data.hideLauncher,
      java: data.javaPath,
    }
    if (!instance.value?.server) {
      await edit({
        ...payload,
        author: data.author,
        description: data.description,
      })
    } else {
      await edit({
        ...payload,
        server: {
          host: data.host,
          port: Number.parseInt(data.port, 10),
        },
      })
    }
  }
  function load() {
    data.loading = false
    const current = instance.value
    if (current) {
      data.name = current.name
      data.hideLauncher = current.hideLauncher
      data.url = current.url
      data.showLog = current.showLog
      data.author = current.author
      data.fileServerApi = current.fileApi
      data.description = current.description || ''
      data.runtime = current.runtime
      data.version = current.version

      if (current.server) {
        data.host = current.server.host
        data.port = current.server.port?.toString() || ''
      }

      data.maxMemory = current.maxMemory
      data.minMemory = current.minMemory
      data.vmOptions = current.vmOptions?.join(' ') || ''
      data.mcOptions = current.mcOptions?.join(' ') || ''
      data.javaPath = current.java
      data.assignMemory = current.assignMemory
      data.fastLaunch = current.fastLaunch
    }
  }

  return {
    isGlobalAssignMemory,
    isGlobalMinMemory,
    isGlobalMaxMemory,
    isGlobalVmOptions,
    isGlobalMcOptions,
    isGlobalFastLaunch,
    isGlobalHideLauncher,
    isGlobalShowLog,
    assignMemory,
    fastLaunch,
    hideLauncher,
    showLog,
    resetAssignMemory,
    resetVmOptions,
    resetMcOptions,
    resetFastLaunch,
    resetHideLauncher,
    resetShowLog,
    minMemory,
    maxMemory,
    mcOptions,
    vmOptions,
    data,
    save,
    load,
  }
}
