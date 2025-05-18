import { EditInstanceOptions, Instance, InstanceData, VersionHeader, RuntimeVersions, isFileNoFound } from '@xmcl/runtime-api'
import { InjectionKey, Ref, set } from 'vue'
import { useGlobalSettings } from './setting'
import debounce from 'lodash.debounce'
import { injection } from '@/util/inject'
import { kLaunchButton } from './launchButton'
import { AnyError } from '@/util/error'

export const InstanceEditInjectionKey: InjectionKey<ReturnType<typeof useInstanceEdit>> = Symbol('InstanceEdit')

/**
 * Edit the instance data model.
 *
 * @param instance The instance to edit
 * @returns The instance edit data
 */
export function useInstanceEdit(instance: Ref<Instance>, edit: (instance: EditInstanceOptions & { instancePath: string }) => Promise<void>) {
  const {
    globalAssignMemory, globalFastLaunch, globalHideLauncher, globalMaxMemory,
    globalMcOptions, globalMinMemory, globalShowLog, globalVmOptions,
    globalDisableAuthlibInjector, globalDisableElyByAuthlib,
    globalPrependCommand, globalPreExecuteCommand,
    globalEnv, globalResolution,
  } = useGlobalSettings()

  const data = reactive({
    path: instance.value.path,
    name: instance.value?.name ?? '',

    host: '', // mc.hypixel.com
    port: '', // 25565

    author: '',
    description: '',
    url: '',
    fileServerApi: '',

    vmOptions: instance.value?.vmOptions?.join(' '),
    mcOptions: instance.value?.mcOptions?.join(' '),
    prependCommand: instance.value?.prependCommand,
    preExecuteCommand: instance.value?.preExecuteCommand,
    maxMemory: instance.value?.maxMemory,
    minMemory: instance.value?.minMemory,
    env: instance.value?.env ?? {},

    runtime: {
      minecraft: instance.value?.runtime.minecraft ?? '',
      forge: instance.value?.runtime.forge ?? '',
      fabricLoader: instance.value?.runtime.fabricLoader ?? '',
      quiltLoader: instance.value?.runtime.quiltLoader ?? '',
      optifine: instance.value?.runtime.optifine ?? '',
      liteloader: instance.value?.runtime.liteloader ?? '',
      neoForged: instance.value?.runtime.neoForged ?? '',
      labyMod: instance.value?.runtime.labyMod ?? '',
    } as RuntimeVersions,
    version: '',

    fastLaunch: instance.value?.fastLaunch,
    hideLauncher: instance.value?.hideLauncher,
    showLog: instance.value?.showLog,
    disableElyByAuthlib: instance.value?.disableElybyAuthlib,
    disableAuthlibInjector: instance.value?.disableAuthlibInjector,

    assignMemory: instance.value?.assignMemory,

    javaPath: instance.value?.java,

    icon: instance.value?.icon,

    resolution: instance.value?.resolution,

    loading: true,
  })

  const isGlobalAssignMemory = computed(() => data.assignMemory === undefined)
  const isGlobalMinMemory = computed(() => data.minMemory === undefined)
  const isGlobalMaxMemory = computed(() => data.maxMemory === undefined)
  const isGlobalVmOptions = computed(() => data.vmOptions === undefined)
  const isGlobalMcOptions = computed(() => data.mcOptions === undefined)
  const isGlobalFastLaunch = computed(() => data.fastLaunch === undefined)
  const isGlobalHideLauncher = computed(() => data.hideLauncher === undefined)
  const isGlobalShowLog = computed(() => data.showLog === undefined)
  const isGlobalDisableElyByAuthlib = computed(() => data.disableElyByAuthlib === undefined)
  const isGlobalDisableAuthlibInjector = computed(() => data.disableAuthlibInjector === undefined)
  const isGlobalPrependCommand = computed(() => data.prependCommand === undefined)
  const isGlobalPreExecuteCommand = computed(() => data.preExecuteCommand === undefined)
  const isGlobalResolution = computed(() => data.resolution === undefined)

  const resetAssignMemory = () => {
    set(data, 'assignMemory', undefined)
    set(data, 'minMemory', undefined)
    set(data, 'maxMemory', undefined)
    saveJIT()
  }
  const resetVmOptions = () => {
    set(data, 'vmOptions', undefined)
    saveJIT()
  }
  const resetPrependCommand = () => {
    set(data, 'prependCommand', undefined)
    saveJIT()
  }
  const resetPreExecuteCommand = () => {
    set(data, 'preExecuteCommand', undefined)
    saveJIT()
  }

  const resetResolution = () => {
    set(data, 'resolution', undefined)
    saveJIT()
  }
  const resetMcOptions = () => {
    set(data, 'mcOptions', undefined)
    saveJIT()
  }
  const resetFastLaunch = () => {
    set(data, 'fastLaunch', undefined)
    saveJIT()
  }
  const resetHideLauncher = () => {
    data.hideLauncher = undefined
    saveJIT()
  }
  const resetShowLog = () => {
    data.showLog = undefined
    saveJIT()
  }
  const resetDisableAuthlibInjector = () => {
    data.disableAuthlibInjector = undefined
    saveJIT()
  }
  const resetDisableElyByAuthlib = () => {
    data.disableElyByAuthlib = undefined
    saveJIT()
  }

  const assignMemory = computed({
    get: () => data.assignMemory ?? globalAssignMemory.value,
    set: (v) => { set(data, 'assignMemory', v); saveJIT() },
  })
  const minMemory = computed({
    get: () => data.minMemory ?? globalMinMemory.value,
    set: (v) => {
      if (data.assignMemory !== true) {
        set(data, 'assignMemory', true)
      }
      set(data, 'minMemory', v)
      saveJIT()
    },
  })
  const maxMemory = computed({
    get: () => data.maxMemory ?? globalMaxMemory.value,
    set: (v) => {
      if (data.assignMemory !== true) {
        set(data, 'assignMemory', true)
      }
      set(data, 'maxMemory', v)
      saveJIT()
    },
  })
  const vmOptions = computed({
    get: () => data.vmOptions ?? globalVmOptions.value.join(' '),
    set: (v) => { set(data, 'vmOptions', v); saveJIT() },
  })
  const mcOptions = computed({
    get: () => data.mcOptions ?? globalMcOptions.value.join(' '),
    set: (v) => { set(data, 'mcOptions', v); saveJIT() },
  })
  const prependCommand = computed({
    get: () => data.prependCommand ?? globalPrependCommand.value,
    set: (v) => { set(data, 'prependCommand', v); saveJIT() },
  })
  const preExecuteCommand = computed({
    get: () => data.preExecuteCommand ?? globalPreExecuteCommand.value,
    set: (v) => { set(data, 'preExecuteCommand', v); saveJIT() },
  })
  const fastLaunch = computed({
    get: () => data.fastLaunch ?? globalFastLaunch.value,
    set: (v) => { set(data, 'fastLaunch', v); saveJIT() },
  })
  const hideLauncher = computed({
    get: () => data.hideLauncher ?? globalHideLauncher.value,
    set: (v) => { set(data, 'hideLauncher', v); saveJIT() },
  })
  const showLog = computed({
    get: () => data.showLog ?? globalShowLog.value,
    set: (v) => { set(data, 'showLog', v); saveJIT() },
  })
  const disableAuthlibInjector = computed({
    get: () => data.disableAuthlibInjector ?? globalDisableAuthlibInjector.value,
    set: (v) => { set(data, 'disableAuthlibInjector', v); saveJIT() },
  })
  const disableElyByAuthlib = computed({
    get: () => data.disableElyByAuthlib ?? globalDisableElyByAuthlib.value,
    set: (v) => { set(data, 'disableElyByAuthlib', v); saveJIT() },
  })
  const javaPath = computed({
    get: () => data.javaPath,
    set: (v) => { data.javaPath = v; saveJIT() },
  })
  const resolution = computed({
    get: () => data.resolution ?? globalResolution.value,
    set: (v) => { set(data, 'resolution', v); saveJIT() },
  })
  const env = computed({
    get: () => data.env,
    set: (v) => { data.env = v; saveJIT() },
  })

  const isModified = computed(() => {
    const current = instance.value
    if (!current) {
      return true
    }
    if (current.name !== data.name) {
      return true
    }
    if (current.version !== data.version) {
      return true
    }
    if (current.runtime.minecraft !== data.runtime.minecraft) {
      return true
    }
    if (current.runtime.forge !== data.runtime.forge) {
      return true
    }
    if (current.runtime.neoForged !== data.runtime.neoForged) {
      return true
    }
    if (current.runtime.labyMod !== data.runtime.labyMod) {
      return true
    }
    if (current.runtime.fabricLoader !== data.runtime.fabricLoader) {
      return true
    }
    if (current.runtime.quiltLoader !== data.runtime.quiltLoader) {
      return true
    }
    if (current.runtime.optifine !== data.runtime.optifine) {
      return true
    }
    if (current.icon !== data.icon) {
      return true
    }
    return false
  })

  watch(computed(() => instance.value), () => load(), {
    immediate: true,
    deep: true,
  })

  let buffer: EditInstanceOptions & { instancePath: string } | undefined
  const queue = debounce(flush, 2000)

  async function flush() {
    if (buffer) {
      await edit(buffer)
      buffer = undefined
      load()
    }
  }

  const { usePreclickListener } = injection(kLaunchButton)
  usePreclickListener(flush)

  function enqueue(options: EditInstanceOptions & { instancePath: string }) {
    if (!buffer || buffer.instancePath !== options.instancePath) {
      buffer = {
        ...options,
      }
    } else {
      buffer = {
        ...buffer,
        ...options,
      }
    }
    queue()
  }

  async function saveJIT() {
    const instancePath = instance.value.path
    const payload = {
      url: data.url,
      fileApi: data.fileServerApi,
      minMemory: data.minMemory,
      maxMemory: data.maxMemory,
      vmOptions: data.vmOptions?.split(' ').filter(v => v.length !== 0),
      mcOptions: data.mcOptions?.split(' ').filter(v => v.length !== 0),
      assignMemory: data.assignMemory,
      fastLaunch: data.fastLaunch,
      showLog: data.showLog,
      hideLauncher: data.hideLauncher,
      java: data.javaPath,
      disableAuthlibInjector: data.disableAuthlibInjector,
      disableElybyAuthlib: data.disableElyByAuthlib,
      prependCommand: data.prependCommand,
      preExecuteCommand: data.preExecuteCommand,
      author: data.author,
      description: data.description,
      env: data.env,
      resolution: data.resolution,
    } as EditInstanceOptions
    if (instance.value.server) {
      payload.server = instance.value?.server
        ? {
          host: data.host,
          port: Number.parseInt(data.port, 10),
        }
        : undefined
    }
    enqueue({
      ...payload,
      instancePath,
    })
  }

  async function save() {
    const payload = {
      name: data.name,
      version: data.version,
      runtime: data.runtime,
      icon: data.icon,
      resolution: data.resolution,
    }
    if (!instance.value?.server) {
      await edit({
        ...payload,
        instancePath: instance.value?.path,
        author: data.author,
        description: data.description,
      })
    } else {
      await edit({
        ...payload,
        instancePath: instance.value?.path,
        server: {
          host: data.host,
          port: Number.parseInt(data.port, 10),
        },
      })
    }
    data.icon = instance.value?.icon
    load()
  }
  function load() {
    data.loading = false
    const current = instance.value
    if (current) {
      data.path = current.path
      data.name = current.name
      data.hideLauncher = current.hideLauncher
      data.url = current.url
      data.showLog = current.showLog
      data.author = current.author
      data.fileServerApi = current.fileApi
      data.description = current.description || ''
      data.runtime.fabricLoader = current.runtime.fabricLoader ?? ''
      data.runtime.forge = current.runtime.forge ?? ''
      data.runtime.minecraft = current.runtime.minecraft ?? ''
      data.runtime.optifine = current.runtime.optifine ?? ''
      data.runtime.quiltLoader = current.runtime.quiltLoader ?? ''
      data.runtime.neoForged = current.runtime.neoForged ?? ''
      data.runtime.labyMod = current.runtime.labyMod ?? ''
      data.version = current.version
      data.icon = current.icon
      data.disableAuthlibInjector = current.disableAuthlibInjector
      data.disableElyByAuthlib = current.disableElybyAuthlib
      data.prependCommand = current.prependCommand
      data.preExecuteCommand = current.preExecuteCommand
      data.env = current.env ?? {}

      if (current.server) {
        data.host = current.server.host
        data.port = current.server.port?.toString() || ''
      }

      data.maxMemory = current.maxMemory
      data.minMemory = current.minMemory
      data.vmOptions = current.vmOptions?.join(' ')
      data.mcOptions = current.mcOptions?.join(' ')
      data.javaPath = current.java
      data.assignMemory = current.assignMemory
      data.fastLaunch = current.fastLaunch
      data.resolution = current.resolution
    }
  }

  return {
    isModified,
    isGlobalAssignMemory,
    isGlobalMinMemory,
    isGlobalMaxMemory,
    isGlobalVmOptions,
    isGlobalMcOptions,
    isGlobalFastLaunch,
    isGlobalHideLauncher,
    isGlobalShowLog,
    isGlobalDisableElyByAuthlib,
    isGlobalDisableAuthlibInjector,
    isGlobalPrependCommand,
    isGlobalPreExecuteCommand,
    assignMemory,
    prependCommand,
    preExecuteCommand,
    fastLaunch,
    hideLauncher,
    showLog,
    javaPath,
    disableAuthlibInjector,
    disableElyByAuthlib,
    env,
    globalEnv,
    resetAssignMemory,
    resetVmOptions,
    resetMcOptions,
    resetFastLaunch,
    resetHideLauncher,
    resetShowLog,
    resetDisableAuthlibInjector,
    resetDisableElyByAuthlib,
    resetPrependCommand,
    resetPreExecuteCommand,
    resetResolution,
    minMemory,
    maxMemory,
    mcOptions,
    vmOptions,
    resolution,
    isGlobalResolution,
    data,
    save,
    load,
  }
}

export function useInstanceEditVersions(data: Pick<InstanceData, 'runtime' | 'version'>, versions: Ref<VersionHeader[]>) {
  function onSelectMinecraft(version: string) {
    if (data?.runtime) {
      const runtime = data.runtime
      data.version = ''
      runtime.minecraft = version
      runtime.forge = ''
      runtime.neoForged = ''
      runtime.fabricLoader = ''
      runtime.quiltLoader = ''
      runtime.optifine = ''
    }
  }
  function onSelectForge(version: string) {
    if (data?.runtime) {
      const runtime = data?.runtime
      runtime.forge = version
      if (version) {
        data.version = ''
        runtime.neoForged = ''
        runtime.fabricLoader = ''
        runtime.quiltLoader = ''
        runtime.optifine = ''
      }
    }
  }
  function onSelectNeoForged(version: string) {
    if (data?.runtime) {
      const runtime = data?.runtime
      runtime.neoForged = version
      if (version) {
        data.version = ''
        runtime.forge = ''
        runtime.fabricLoader = ''
        runtime.quiltLoader = ''
        runtime.optifine = ''
      }
    }
  }
  function onSelectFabric(version: string) {
    if (data?.runtime) {
      const runtime = data?.runtime
      if (version) {
        data.version = ''
        runtime.forge = ''
        runtime.neoForged = ''
        runtime.quiltLoader = ''
        runtime.optifine = ''
      }
      runtime.fabricLoader = version
    }
  }
  function onSelectQuilt(version: string) {
    if (data?.runtime) {
      const runtime = data?.runtime
      runtime.quiltLoader = version
      if (version) {
        data.version = ''
        runtime.neoForged = ''
        runtime.forge = runtime.fabricLoader = ''
        runtime.optifine = ''
      }
    }
  }
  function onSelectOptifine(version: string) {
    if (data.runtime) {
      const runtime = data.runtime
      runtime.optifine = version
      if (version) {
        data.version = ''
        runtime.quiltLoader = runtime.fabricLoader = ''
        runtime.neoForged = ''
      }
    }
  }
  function onSelectLabyMod(version: string) {
    if (data.runtime) {
      const runtime = data.runtime
      if ('labyMod' in runtime) {
        runtime.labyMod = version
      } else {
        set(runtime, 'labyMod', version)
      }
      if (version) {
        data.version = ''
        // Select all other to empty
        runtime.quiltLoader = runtime.fabricLoader = ''
        runtime.neoForged = ''
        runtime.optifine = ''
        runtime.forge = ''
      }
    }
  }
  function onSelectLocalVersion(version: string) {
    data.version = version
    const v = versions.value.find(ver => ver.id === version)
    if (v) {
      data.runtime.minecraft = v.minecraft
      data.runtime.forge = v.forge
      data.runtime.liteloader = v.liteloader
      data.runtime.fabricLoader = v.fabric
      data.runtime.neoForged = v.neoForged
      data.runtime.optifine = v.optifine
      data.runtime.quiltLoader = v.quilt
      data.runtime.labyMod = v.labyMod
    } else {
      throw new AnyError('SelectLocalVersionError', `Cannot find version ${version}`)
    }
  }

  return {
    onSelectMinecraft,
    onSelectForge,
    onSelectNeoForged,
    onSelectFabric,
    onSelectQuilt,
    onSelectOptifine,
    onSelectLabyMod,
    onSelectLocalVersion,
  }
}
