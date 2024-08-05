import { useService } from '@/composables'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, BaseServiceKey, Instance, JavaRecord, LaunchException, LaunchOptions, LaunchServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useGlobalSettings, useSettingsState } from './setting'

export const kInstanceLaunch: InjectionKey<ReturnType<typeof useInstanceLaunch>> = Symbol('InstanceLaunch')

export function useInstanceLaunch(
  instance: Ref<Instance>,
  version: Ref<string | undefined>,
  serverVersion: Ref<string | undefined>,
  java: Ref<JavaRecord | undefined>,
  userProfile: Ref<UserProfile>,
  globalState: ReturnType<typeof useSettingsState>,
  enabledModCounts: Ref<number>,
) {
  const { refreshUser } = useService(UserServiceKey)
  const { launch, kill, on, getGameProcesses, reportOperation } = useService(LaunchServiceKey)
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalPrependCommand, globalMcOptions, globalVmOptions, globalFastLaunch, globalHideLauncher, globalShowLog, globalDisableAuthlibInjector, globalDisableElyByAuthlib } = useGlobalSettings(globalState)
  const { getMemoryStatus } = useService(BaseServiceKey)
  const { abortRefresh } = useService(UserServiceKey)
  const { getOrInstallAuthlibInjector, abortAuthlibInjectorInstall } = useService(AuthlibInjectorServiceKey)

  type LaunchStatus = '' | 'spawning-process' | 'refreshing-user' | 'preparing-authlib' | 'assigning-memory'
  const allLaunchingStatus = shallowRef({} as Record<string, LaunchStatus>)
  const launchingStatus = computed(() => allLaunchingStatus.value[instance.value.path] ?? '')
  const launching = computed(() => Object.values(allLaunchingStatus.value).some(v => v.length > 0))

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

  async function track<T>(p: Promise<T>, name: string, id: string) {
    const start = performance.now()
    if (id) {
      reportOperation({
        name,
        operationId: id,
      })
    }
    try {
      const v = await p
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

    const javaRec = java.value
    if (!javaRec) {
      throw new LaunchException({ type: 'launchNoProperJava', javaPath: '' })
    }

    let yggdrasilAgent: LaunchOptions['yggdrasilAgent']

    const authority = tryParseUrl(userProfile.value.authority)

    const inst = instance.value

    const disableAuthlibInjector = inst.disableAuthlibInjector ?? globalDisableAuthlibInjector.value
    if (!disableAuthlibInjector && authority && (authority.protocol === 'http:' || authority?.protocol === 'https:' || userProfile.value.authority === AUTHORITY_DEV)) {
      if (!dry) {
        allLaunchingStatus.value = {
          ...allLaunchingStatus.value,
          [instancePath]: 'preparing-authlib',
        }
        console.log('preparing authlib')
      }
      yggdrasilAgent = {
        jar: await track(getOrInstallAuthlibInjector(), 'prepare-authlib', operationId),
        server: userProfile.value.authority,
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
        allLaunchingStatus.value = {
          ...allLaunchingStatus.value,
          [instancePath]: 'assigning-memory',
        }
      }

      console.log('assigning memory')
      const modCount = enabledModCounts.value
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
      java: javaRec.path,
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

  async function _launch(instancePath: string, operationId: string, side: 'client' | 'server', overrides?: Partial<LaunchOptions>) {
    try {
      error.value = undefined
      const options = await generateLaunchOptions(instancePath, operationId, side, overrides)

      if (!options.skipAssetsCheck) {
        allLaunchingStatus.value = {
          ...allLaunchingStatus.value,
          [instancePath]: 'refreshing-user',
        }

        console.log('refreshing user')
        try {
          await track(Promise.race([
            new Promise((resolve, reject) => { setTimeout(() => reject(new Error('Timeout')), 5_000) }),
            refreshUser(userProfile.value.id),
          ]), 'refresh-user', operationId)
        } catch (e) {
        }
      }

      allLaunchingStatus.value = {
        ...allLaunchingStatus.value,
        [instancePath]: 'spawning-process',
      }

      console.log('spawning process')
      const pid = await launch(options)
      if (pid) {
        data.value?.push({
          pid,
          ready: false,
          options,
          side,
        })
      }
    } catch (e) {
      console.error(e)
      error.value = e as any
      throw e
    } finally {
      allLaunchingStatus.value = { ...allLaunchingStatus.value, [instancePath]: '' }
    }
  }

  async function launchWithTracking(side = 'client' as 'client' | 'server', overrides?: Partial<LaunchOptions>) {
    const operationId = crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
    const instancePath = instance.value.path
    await track(_launch(instancePath, operationId, side, overrides), 'launch', operationId)
  }

  async function killGame(side: 'client' | 'server' = 'client') {
    if (launchingStatus.value === 'refreshing-user') {
      abortRefresh()
    }
    if (launchingStatus.value === 'preparing-authlib') {
      abortAuthlibInjectorInstall()
    }
    if (data.value) {
      for (const p of data.value) {
        if (p.side === side) {
          await kill(p.pid)
        }
      }
    }
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
  }
}
