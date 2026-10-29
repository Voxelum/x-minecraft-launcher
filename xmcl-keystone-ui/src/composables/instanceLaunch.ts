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
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalPreExecuteCommand, globalPrependCommand, globalMcOptions, globalVmOptions, globalFastLaunch, globalEnv, globalHideLauncher, globalShowLog, globalDisableAuthlibInjector, globalDisableElyByAuthlib, globalResolution } = useGlobalSettings(globalState)
  const { getOrInstallAuthlibInjector } = useService(AuthlibInjectorServiceKey)

  type LaunchStatus = '' | 'spawning-process' | 'refreshing-user' | 'preparing-authlib' | 'assigning-memory' | 'checking-permission' | 'launching'
  type LaunchStatusState = {
    status: LaunchStatus
    controllers: Record<string, AbortController>
    aborted: boolean
  }
  const allLaunchingStatus = shallowRef({} as Record<string, LaunchStatusState>)
  const launchToken = computed(() => getLaunchToken(userProfile.value, instance.value.path))
  const launchingStatus = computed(() => allLaunchingStatus.value[launchToken.value]?.status ?? '')
  const launching = computed(() => Object.values(allLaunchingStatus.value).some(v => v.status.length > 0))

  function assignStatus(token: string, status: LaunchStatus, controller?: AbortController, state = allLaunchingStatus.value[token]) {
    if (!state || allLaunchingStatus.value[token] !== state) return
    const oldVal = allLaunchingStatus.value
    if (controller) state.controllers[status] = controller
    state.status = status
    allLaunchingStatus.value = { ...oldVal }
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

  async function track<T>(token: string, p: Promise<T> | (() => Promise<T>), name: LaunchStatus, id: string, state = allLaunchingStatus.value[token]) {
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
        assignStatus(token, name, controller, state)
      }
      const cancelled = new Promise<T>((resolve, reject) => {
        controller.signal.onabort = () => reject(new Error('Aborted'))
        if (state?.aborted) controller.abort()
      })
      const pending = typeof p === 'function' ? p() : p
      const v = await Promise.race([pending, cancelled])
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

  async function generateLaunchOptions(instancePath: string, userProfile: UserProfile, operationId: string, side = 'client' as 'client' | 'server', overrides?: Partial<LaunchOptions>, dry = false, state = allLaunchingStatus.value[getLaunchToken(userProfile, instancePath)]) {
    const ver = overrides?.version ?? side === 'client' ? version.value : serverVersion.value
    const token = getLaunchToken(userProfile, instancePath)

    return await generateLaunchOptionsWithGlobal(
      { ...instance.value, path: instancePath },
      userProfile,
      ver,
      {
        token,
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
        globalPreExecuteCommand: globalPreExecuteCommand.value,
        globalResolution: globalResolution.value,
        modCount: mods.value.length,
        getOrInstallAuthlibInjector,
        track: (token, pending, name, id) => track(token, pending, name as LaunchStatus, id, state),
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

  function getLaunchToken(userProfile: UserProfile, instancePath: string) {
    return `${userProfile.id}@${instancePath}`
    // return instancePath
  }

  async function _launch(instancePath: string, user: UserProfile, operationId: string, side: 'client' | 'server', overrides: Partial<LaunchOptions> | undefined, state: LaunchStatusState) {
    const token = getLaunchToken(user, instancePath)
    try {
      error.value = undefined
      const options = await generateLaunchOptions(instancePath, user, operationId, side, overrides, false, state)
      if (state.aborted) return

      if (!options.skipAssetsCheck && side === 'client') {
        console.log('refreshing user')
        try {
          await track(token, refreshUser(user.id, { validate: true }), 'refreshing-user', operationId, state)
        } catch (e) {
          if (state.aborted) return
          console.error(e)
        }
      }

      if (shouldEnableVoiceChat() && side === 'client') {
        try {
          await track(token, windowController.queryAudioPermission(), 'checking-permission', operationId, state)
        } catch (e) {
          if (state.aborted) return
          console.error(e)
        }
      }

      if (state.aborted) return
      assignStatus(token, 'spawning-process', undefined, state)
      console.log('spawning process')

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
      if (state.aborted) return
      console.error(e)
      error.value = e as any
      throw e
    } finally {
      assignStatus(token, '', undefined, state)
    }
  }

  async function launchWithTracking(side = 'client' as 'client' | 'server', overrides?: Partial<LaunchOptions>) {
    const operationId = crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
    const instancePath = instance.value.path
    const user = userProfile.value
    const token = getLaunchToken(user, instancePath)
    const state: LaunchStatusState = markRaw({ status: 'launching', controllers: {}, aborted: false })
    allLaunchingStatus.value = { ...allLaunchingStatus.value, [token]: state }
    try {
      // Install the outer cancellation handler before starting asynchronous preparation.
      await track(token, () => _launch(instancePath, user, operationId, side, overrides, state), 'launching', operationId, state)
    } catch (e) {
      if (!state.aborted) throw e
    } finally {
      assignStatus(token, '', undefined, state)
    }
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
    const token = launchToken.value
    const state = allLaunchingStatus.value[token]
    if (!state || !state.status) return
    state.aborted = true
    const controllers = state.controllers
    for (const controller of Object.values(controllers)) controller.abort()
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
      const token = launchToken.value
      const controllers = allLaunchingStatus.value[token]?.controllers
      controllers?.['preparing-authlib']?.abort()
    },
    skipRefresh: () => {
      const token = launchToken.value
      const controllers = allLaunchingStatus.value[token]?.controllers
      controllers?.['refreshing-user']?.abort()
    },
    skipPermission: () => {
      const token = launchToken.value
      const controllers = allLaunchingStatus.value[token]?.controllers
      controllers?.['checking-permission']?.abort()
    },
  }
}
