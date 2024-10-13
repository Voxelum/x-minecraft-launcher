import { useService } from '@/composables'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, Instance, JavaRecord, LaunchException, LaunchOptions, LaunchServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useGlobalSettings, useSettingsState } from './setting'
import { ModFile } from '@/util/mod'

export const kInstanceLaunch: InjectionKey<ReturnType<typeof useInstanceLaunch>> = Symbol('InstanceLaunch')

export function useInstanceLaunch(
  instance: Ref<Instance>,
  version: Ref<string | undefined>,
  serverVersion: Ref<string | undefined>,
  java: Ref<JavaRecord | undefined>,
  userProfile: Ref<UserProfile>,
  globalState: ReturnType<typeof useSettingsState>,
  mods: Ref<ModFile[]>,
) {
  const { refreshUser } = useService(UserServiceKey)
  const { launch, kill, on, getGameProcesses, reportOperation } = useService(LaunchServiceKey)
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalPrependCommand, globalMcOptions, globalVmOptions, globalFastLaunch, globalHideLauncher, globalShowLog, globalDisableAuthlibInjector, globalDisableElyByAuthlib } = useGlobalSettings(globalState)
  const { getOrInstallAuthlibInjector } = useService(AuthlibInjectorServiceKey)

  type LaunchStatus = '' | 'spawning-process' | 'refreshing-user' | 'preparing-authlib' | 'assigning-memory' | 'checking-permission' | 'launching'
  type LaunchStatusState = {
    status: LaunchStatus
    controllers: Record<string, AbortController>
    aborted: boolean
  }
  const allLaunchingStatus = shallowRef({} as Record<string, LaunchStatusState>)
  const launchingStatus = computed(() => allLaunchingStatus.value[instance.value.path]?.status ?? '')
  const launching = computed(() => Object.values(allLaunchingStatus.value).some(v => v.status.length > 0))

  function assignStatus(path: string, status: LaunchStatus, controller?: AbortController) {
    const oldVal = allLaunchingStatus.value
    const controllers = oldVal[path]?.controllers || {}
    if (controller) {
      controllers[status] = controller
    }
    allLaunchingStatus.value = {
      ...oldVal,
      [path]: markRaw({
        aborted: false,
        status,
        controllers,
      }),
    }
  }

  const error = ref<any | undefined>(undefined)

  const { data, mutate } = useSWRV(computed(() => `/${instance.value.path}/games`), async () => {
    console.log('revalidate game processes')
    const processes = await getGameProcesses()
    const filtered = processes.filter(p => p.options.gameDirectory === instance.value.path)
    return filtered
  })
  watch(instance, () => {
    mutate()
  })

  function tryParseUrl(url: string) {
    try {
      return new URL(url)
    } catch {
      return undefined
    }
  }

  const gameProcesses = computed(() => data.value || [])
  const count = computed(() => data.value?.filter(v => v.side === 'client').length ?? 0)
  const serverCount = computed(() => data.value?.filter(v => v.side === 'server').length ?? 0)

  const windowReady = computed(() => {
    return data.value?.every(p => p.ready)
  })

  on('minecraft-window-ready', ({ pid }) => {
    const game = data.value?.find(p => p.pid === pid)
    if (game) {
      game.ready = true
    }
  })

  on('minecraft-exit', ({ pid }) => {
    data.value = data.value?.filter(p => p.pid !== pid)
  })

  async function track<T>(token: string, p: Promise<T>, name: LaunchStatus, id: string) {
    const start = performance.now()
    if (id) {
      reportOperation({
        name,
        operationId: id,
      })
    }
    try {
      const controller = new AbortController()
      assignStatus(token, name, controller)
      const v = await Promise.race([p, new Promise<T>((resolve, reject) => {
        controller.signal.onabort = () => {
          reject(new Error('Aborted'))
        }
      })])
      if (id) {
        reportOperation({
          duration: performance.now() - start,
          name,
          operationId: id,
          success: true,
        })
      }
      return v
    } catch (e) {
      if (id) {
        reportOperation({
          duration: performance.now() - start,
          name,
          operationId: id,
          success: false,
        })
      }
      throw e
    }
  }

  async function generateLaunchOptions(instancePath: string, operationId: string, side = 'client' as 'client' | 'server', overrides?: Partial<LaunchOptions>, dry = false) {
    const ver = overrides?.version ?? side === 'client' ? version.value : serverVersion.value

    if (!ver) {
      throw new LaunchException({ type: 'launchNoVersionInstalled' })
    }

    const javaPath = overrides?.java ?? java.value?.path
    if (!javaPath) {
      throw new LaunchException({ type: 'launchNoProperJava', javaPath: '' })
    }

    let yggdrasilAgent: LaunchOptions['yggdrasilAgent']

    const authority = tryParseUrl(userProfile.value.authority)

    const inst = instance.value

    const disableAuthlibInjector = inst.disableAuthlibInjector ?? globalDisableAuthlibInjector.value
    if (!disableAuthlibInjector && authority && (authority.protocol === 'http:' || authority?.protocol === 'https:' || userProfile.value.authority === AUTHORITY_DEV)) {
      try {
        yggdrasilAgent = {
          jar: await track(instancePath, getOrInstallAuthlibInjector(), 'preparing-authlib', operationId),
          server: userProfile.value.authority,
        }
      } catch {
        // TODO: notify user
      }
    }

    const assignMemory = inst.assignMemory ?? globalAssignMemory.value
    const hideLauncher = inst.hideLauncher ?? globalHideLauncher.value
    const showLog = inst.showLog ?? globalShowLog.value
    const fastLaunch = inst.fastLaunch ?? globalFastLaunch.value
    const disableElyByAuthlib = inst.disableElybyAuthlib ?? globalDisableElyByAuthlib.value

    let minMemory: number | undefined = inst.minMemory ?? globalMinMemory.value
    let maxMemory: number | undefined = inst.maxMemory ?? globalMaxMemory.value
    if (assignMemory === true && minMemory > 0) {
      // noop
    } else if (assignMemory === 'auto') {
      if (!dry) {
        assignStatus(instancePath, 'assigning-memory')
      }

      const modCount = mods.value.length
      if (modCount === 0) {
        minMemory = 1024
      } else {
        const level = modCount / 25
        const rounded = Math.floor(level)
        const percentage = level - rounded
        minMemory = rounded * 1024 + (percentage > 0.5 ? 512 : 0) + 1024
      }
    } else {
      minMemory = undefined
    }
    maxMemory = assignMemory === true && maxMemory > 0 ? maxMemory : undefined

    const vmOptions = inst.vmOptions ?? globalVmOptions.value.filter(v => !!v)
    const mcOptions = inst.mcOptions ?? globalMcOptions.value.filter(v => !!v)
    const prependCommand = inst.prependCommand ?? globalPrependCommand.value

    const options: LaunchOptions = {
      operationId,
      version: ver,
      gameDirectory: instance.value.path,
      user: userProfile.value,
      java: javaPath,
      hideLauncher,
      showLog,
      minMemory,
      maxMemory,
      skipAssetsCheck: fastLaunch,
      vmOptions,
      mcOptions,
      yggdrasilAgent,
      disableElyByAuthlib,
      prependCommand,
      side,
      server: inst.server ?? undefined,
      ...(overrides || {}),
    }
    return options
  }

  function shouldEnableVoiceChat() {
    if (instance.value.runtime.labyMod) {
      return true
    }
    const allMods = mods.value
    return allMods.some(m => m.modId === 'voicechat')
  }

  async function _launch(instancePath: string, operationId: string, side: 'client' | 'server', overrides?: Partial<LaunchOptions>) {
    try {
      error.value = undefined
      const options = await generateLaunchOptions(instancePath, operationId, side, overrides)

      if (!options.skipAssetsCheck) {
        console.log('refreshing user')
        try {
          await track(instancePath, refreshUser(userProfile.value.id, { validate: true }), 'refreshing-user', operationId)
        } catch (e) {
          console.error(e)
        }
      }

      if (shouldEnableVoiceChat()) {
        try {
          await track(instancePath, windowController.queryAudioPermission(), 'checking-permission', operationId)
        } catch (e) {
          console.error(e)
        }
      }

      assignStatus(instancePath, 'spawning-process')
      console.log('spawning process')

      const state = allLaunchingStatus.value[instancePath]
      if (state?.aborted) {
        return
      }
      const pid = await launch(options)
      if (pid) {
        mutate()
        if (state.aborted) {
          await kill(pid)
        } else {
          data.value?.push({
            pid,
            ready: false,
            options,
            side,
          })
        }
      }
    } catch (e) {
      console.error(e)
      error.value = e as any
      throw e
    } finally {
      assignStatus(instancePath, '')
    }
  }

  async function launchWithTracking(side = 'client' as 'client' | 'server', overrides?: Partial<LaunchOptions>) {
    const operationId = crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
    const instancePath = instance.value.path
    await track(instancePath, _launch(instancePath, operationId, side, overrides), 'launching', operationId)
  }

  async function killGame(side: 'client' | 'server' = 'client') {
    if (data.value) {
      for (const p of data.value) {
        if (p.side === side) {
          await kill(p.pid)
        }
      }
    }
  }

  function abort() {
    const path = instance.value.path
    const state = allLaunchingStatus.value[path]
    state.aborted = true
    const controllers = state.controllers
    controllers['preparing-authlib']?.abort()
    controllers['refresh-user']?.abort()
    controllers['checking-permission']?.abort()
  }

  return {
    launch: launchWithTracking,
    kill: killGame,
    gameProcesses,
    windowReady,
    error,
    serverCount,
    count,
    launching,
    launchingStatus,
    generateLaunchOptions,
    abort,
    skipAuthLib: () => {
      const path = instance.value.path
      const controllers = allLaunchingStatus.value[path].controllers
      controllers['preparing-authlib']?.abort()
    },
    skipRefresh: () => {
      const path = instance.value.path
      const controllers = allLaunchingStatus.value[path].controllers
      controllers['refreshing-user']?.abort()
    },
    skipPermission: () => {
      const path = instance.value.path
      const controllers = allLaunchingStatus.value[path].controllers
      controllers['checking-permission']?.abort()
    },
  }
}
