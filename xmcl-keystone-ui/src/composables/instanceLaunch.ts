import { useService } from '@/composables'
import { ModFile } from '@/util/mod'
import { Instance, isBedrockInstance } from '@xmcl/instance'
import {
  AuthlibInjectorServiceKey,
  BedrockServiceKey,
  JavaRecord,
  LaunchOptions,
  LaunchServiceKey,
  UserProfile,
  UserServiceKey,
  generateLaunchOptionsWithGlobal,
} from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useGlobalSettings, useSettingsState } from './setting'
import {
  isRuntimeServiceError,
  runRendererAction,
  type RendererActionScope,
} from '@/rendererAction'

export const kInstanceLaunch: InjectionKey<ReturnType<typeof useInstanceLaunch>> =
  Symbol('InstanceLaunch')

export async function resolveLaunchId(
  pid: number,
  eventLaunchId: string | undefined,
  getGameProcess: (pid: number) => Promise<{ launchId: string } | undefined>,
) {
  return eventLaunchId || (await getGameProcess(pid))?.launchId
}

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
  const { launch, kill, on, removeListener, getGameProcess, getGameProcesses } =
    useService(LaunchServiceKey)
  const { launch: launchBedrock } = useService(BedrockServiceKey)
  const {
    globalAssignMemory,
    globalMaxMemory,
    globalMinMemory,
    globalPreExecuteCommand,
    globalPrependCommand,
    globalMcOptions,
    globalVmOptions,
    globalFastLaunch,
    globalEnv,
    globalHideLauncher,
    globalShowLog,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalResolution,
  } = useGlobalSettings(globalState)
  const { getOrInstallAuthlibInjector } = useService(AuthlibInjectorServiceKey)

  type LaunchStatus =
    | ''
    | 'spawning-process'
    | 'refreshing-user'
    | 'preparing-authlib'
    | 'assigning-memory'
    | 'checking-permission'
    | 'launching'
  type LaunchStatusState = {
    status: LaunchStatus
    controllers: Record<string, AbortController>
    aborted: boolean
  }
  const allLaunchingStatus = shallowRef({} as Record<string, LaunchStatusState>)
  const launchToken = computed(() => getLaunchToken(userProfile.value, instance.value.path))
  const launchingStatus = computed(() => allLaunchingStatus.value[launchToken.value]?.status ?? '')
  const launching = computed(() =>
    Object.values(allLaunchingStatus.value).some((v) => v.status.length > 0),
  )

  function assignStatus(token: string, status: LaunchStatus, controller?: AbortController) {
    const oldVal = allLaunchingStatus.value
    const controllers = oldVal[token]?.controllers || {}
    if (controller) {
      controllers[status] = controller
    }
    allLaunchingStatus.value = {
      ...oldVal,
      [token]: markRaw({
        aborted: false,
        status,
        controllers,
      }),
    }
  }

  const error = ref<any | undefined>(undefined)

  const { data, mutate } = useSWRV(
    computed(() => `/${instance.value.path}/games`),
    async () => {
      console.log('revalidate game processes')
      const processes = await getGameProcesses()
      const filtered = processes.filter((p) => p.options.gameDirectory === instance.value.path)
      return filtered
    },
  )
  watch(instance, () => {
    mutate()
  })

  const gameProcesses = computed(() => data.value || [])
  const count = computed(() => data.value?.filter((v) => v.side === 'client').length ?? 0)
  const serverCount = computed(() => data.value?.filter((v) => v.side === 'server').length ?? 0)

  const windowReady = computed(() => {
    return data.value?.every((p) => p.ready)
  })

  on('minecraft-window-ready', ({ pid }) => {
    const game = data.value?.find((p) => p.pid === pid)
    if (game) {
      game.ready = true
    }
  })

  on('minecraft-exit', ({ pid }) => {
    data.value = data.value?.filter((p) => p.pid !== pid)
  })

  async function track<T>(
    action: RendererActionScope | undefined,
    token: string,
    operation: () => Promise<T>,
    name: LaunchStatus,
  ) {
    const controller = new AbortController()
    assignStatus(token, name, controller)
    return Promise.race([
      action ? action.run(operation) : operation(),
      new Promise<T>((resolve, reject) => {
        controller.signal.onabort = () => {
          reject(new Error('Aborted'))
        }
      }),
    ])
  }

  async function generateLaunchOptions(
    instancePath: string,
    userProfile: UserProfile,
    operationId: string,
    side = 'client' as 'client' | 'server',
    overrides?: Partial<LaunchOptions>,
    dry = false,
    action?: RendererActionScope,
  ) {
    const ver = overrides?.version ?? (side === 'client' ? version.value : serverVersion.value)
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
        track: ((token: string, operation: () => Promise<any>, name: LaunchStatus) =>
          track(action, token, operation, name)) as any,
      },
    )
  }

  function shouldEnableVoiceChat() {
    if (instance.value.runtime.labyMod) {
      return true
    }
    const allMods = mods.value
    return allMods.some((m) => m.modId === 'voicechat')
  }

  function getLaunchToken(userProfile: UserProfile, instancePath: string) {
    return `${userProfile.id}@${instancePath}`
    // return instancePath
  }

  async function _launch(
    action: RendererActionScope,
    instancePath: string,
    user: UserProfile,
    operationId: string,
    side: 'client' | 'server',
    overrides?: Partial<LaunchOptions>,
  ) {
    const token = getLaunchToken(user, instancePath)
    // Bedrock instances are launched through the Microsoft Store UWP package
    // (Windows only). They have no JVM, version or asset pipeline, so bypass
    // the Java launch flow entirely.
    if (isBedrockInstance(instance.value)) {
      try {
        error.value = undefined
        assignStatus(token, 'spawning-process')
        await action.run(() => launchBedrock())
      } catch (e) {
        if (!isRuntimeServiceError(e)) console.error(e)
        error.value = e as any
        throw e
      } finally {
        assignStatus(token, '')
      }
      return { operationId }
    }
    try {
      error.value = undefined
      const options = await generateLaunchOptions(
        instancePath,
        user,
        operationId,
        side,
        overrides,
        false,
        action,
      )

      // Always refresh the access token before launching so the game uses
      // a fresh one. The Singleton lock on refreshUser dedupes with the
      // startup refresh, and refreshUser is a no-op when the token isn't
      // close to expiry. Only ping Mojang's joinServer to validate when
      // the slow asset check is also enabled — fast launch keeps fast.
      if (user.id && side === 'client') {
        try {
          await track(
            action,
            token,
            () =>
              refreshUser(user.id, { validate: !options.skipAssetsCheck }).then(
                (profile: UserProfile) => {
                user = profile
                },
              ),
            'refreshing-user',
          )
        } catch (e) {
          if (!isRuntimeServiceError(e)) console.error(e)
        }
      }

      if (shouldEnableVoiceChat() && side === 'client') {
        try {
          await track(
            action,
            token,
            () => windowController.queryAudioPermission(),
            'checking-permission',
          )
        } catch (e) {
          if (!isRuntimeServiceError(e)) console.error(e)
        }
      }

      assignStatus(token, 'spawning-process')
      console.log('spawning process')

      const state = allLaunchingStatus.value[token]
      if (state?.aborted) {
        return
      }
      let launchId: string | undefined
      const captureLaunch = (event: { launchId: string; operationId?: string }) => {
        if (event.operationId === operationId) launchId = event.launchId
      }
      on('minecraft-start', captureLaunch)
      const pid = await action
        .run(() => launch(options))
        .finally(() => removeListener('minecraft-start', captureLaunch))
      if (pid) {
        launchId = await resolveLaunchId(pid, launchId, (pid) =>
          action.run(() => getGameProcess(pid)),
        )
        if (!launchId) throw new Error('Launch started but no launch ID was reported')
        mutate()
        if (state.aborted) {
          await action.run(() => kill(pid))
        } else {
          data.value?.push({
            pid,
            launchId,
            ready: false,
            options,
            side,
          })
        }
        return { operationId, pid, launchId }
      }
      return { operationId }
    } catch (e) {
      if (!isRuntimeServiceError(e)) console.error(e)
      error.value = e as any
      throw e
    } finally {
      assignStatus(token, '')
    }
  }

  async function launchWithTracking(
    side = 'client' as 'client' | 'server',
    overrides?: Partial<LaunchOptions>,
    parentAction?: RendererActionScope,
  ) {
    return runRendererAction(
      parentAction,
      'user_action.minecraft.launch',
      async (action) => {
        const operationId =
          action.context?.traceparent.split('-')[1] ??
          crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
        const instancePath = instance.value.path
        const user = userProfile.value
        const token = getLaunchToken(user, instancePath)
        return await track(
          action,
          token,
          () => _launch(action, instancePath, user, operationId, side, overrides),
          'launching',
        )
      },
      {
        'game.side': side,
        'instance.edition': instance.value.edition,
      },
    )
  }

  async function launchAs(
    user: UserProfile,
    side = 'client' as 'client' | 'server',
    overrides?: Partial<LaunchOptions>,
    parentAction?: RendererActionScope,
  ) {
    return runRendererAction(
      parentAction,
      'user_action.minecraft.launch',
      async (action) => {
        const operationId =
          action.context?.traceparent.split('-')[1] ??
          crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
        const instancePath = instance.value.path
        const token = getLaunchToken(user, instancePath)
        return await track(
          action,
          token,
          () => _launch(action, instancePath, user, operationId, side, overrides),
          'launching',
        )
      },
      {
        'game.side': side,
        'instance.edition': instance.value.edition,
      },
    )
  }

  async function killGame(side: 'client' | 'server' = 'client', force?: boolean) {
    if (data.value) {
      for (const p of data.value) {
        if (p.side === side) {
          await kill(p.pid, force)
        }
      }
    }
  }

  function abort() {
    const token = launchToken.value
    const state = allLaunchingStatus.value[token]
    state.aborted = true
    const controllers = state.controllers
    controllers['preparing-authlib']?.abort()
    controllers['refresh-user']?.abort()
    controllers['checking-permission']?.abort()
  }

  return {
    launch: launchWithTracking,
    launchAs,
    kill: killGame,
    killPid: (pid: number) => kill(pid),
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
      const controllers = allLaunchingStatus.value[token].controllers
      controllers['preparing-authlib']?.abort()
    },
    skipRefresh: () => {
      const token = launchToken.value
      const controllers = allLaunchingStatus.value[token].controllers
      controllers['refreshing-user']?.abort()
    },
    skipPermission: () => {
      const token = launchToken.value
      const controllers = allLaunchingStatus.value[token].controllers
      controllers['checking-permission']?.abort()
    },
  }
}
