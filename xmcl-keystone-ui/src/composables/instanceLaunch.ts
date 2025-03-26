import { useService } from '@/composables'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, Instance, JavaRecord, LaunchException, LaunchOptions, LaunchServiceKey, UserProfile, UserServiceKey, generateLaunchOptionsWithGlobal } from '@xmcl/runtime-api'
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
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalPrependCommand, globalMcOptions, globalVmOptions, globalFastLaunch, globalEnv, globalHideLauncher, globalShowLog, globalDisableAuthlibInjector, globalDisableElyByAuthlib } = useGlobalSettings(globalState)
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
      if (id) {
        assignStatus(token, name, controller)
      }
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

    return await generateLaunchOptionsWithGlobal(
      { ...instance.value, path: instancePath },
      userProfile.value,
      ver,
      {
        operationId,
        side,
        overrides,
        dry,
        javaPath: java.value?.path,
        globalEnv: globalEnv.value,
        globalVmOptions: globalVmOptions.value,
        globalMcOptions: globalMcOptions.value,
        globalPrependCommand: globalPrependCommand.value,
        globalAssignMemory: globalAssignMemory.value,
        globalMinMemory: globalMinMemory.value,
        globalMaxMemory: globalMaxMemory.value,
        globalHideLauncher: globalHideLauncher.value,
        globalShowLog: globalShowLog.value,
        globalFastLaunch: globalFastLaunch.value,
        globalDisableAuthlibInjector: globalDisableAuthlibInjector.value,
        globalDisableElyByAuthlib: globalDisableElyByAuthlib.value,
        modCount: mods.value.length,
        getOrInstallAuthlibInjector,
        track: track as any,
      }
    )
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

      if (!options.skipAssetsCheck && side === 'client') {
        console.log('refreshing user')
        try {
          await track(instancePath, refreshUser(userProfile.value.id, { validate: true }), 'refreshing-user', operationId)
        } catch (e) {
          console.error(e)
        }
      }

      if (shouldEnableVoiceChat() && side === 'client') {
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
