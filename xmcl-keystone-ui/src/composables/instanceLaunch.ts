import { useService } from '@/composables'
import { ResolvedVersion } from '@xmcl/core'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, BaseServiceKey, Instance, JavaRecord, LaunchException, LaunchOptions, LaunchServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useGlobalSettings, useSettingsState } from './setting'

export const kInstanceLaunch: InjectionKey<ReturnType<typeof useInstanceLaunch>> = Symbol('InstanceLaunch')

export function useInstanceLaunch(instance: Ref<Instance>, resolvedVersion: Ref<ResolvedVersion | { requirements: Record<string, any> } | undefined>, java: Ref<JavaRecord | undefined>, userProfile: Ref<UserProfile>, globalState: ReturnType<typeof useSettingsState>) {
  const { refreshUser } = useService(UserServiceKey)
  const { launch, kill, on, getGameProcesses } = useService(LaunchServiceKey)
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalMcOptions, globalVmOptions, globalFastLaunch, globalHideLauncher, globalShowLog } = useGlobalSettings(globalState)
  const { getMemoryStatus } = useService(BaseServiceKey)
  const { abortRefresh } = useService(UserServiceKey)
  const { getOrInstallAuthlibInjector, abortAuthlibInjectorInstall } = useService(AuthlibInjectorServiceKey)

  const launchingStatus = ref('' as '' | 'spawning-process' | 'refreshing-user' | 'preparing-authlib' | 'assigning-memory')
  const launching = computed(() => !!launchingStatus.value)

  const error = ref<any | undefined>(undefined)

  const { data, mutate } = useSWRV(`/${instance.value.path}/games`, async () => {
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

  const count = computed(() => data.value?.length ?? 0)

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

  async function generateLaunchOptions() {
    const ver = resolvedVersion.value
    if (!ver || 'requirements' in ver) {
      throw new LaunchException({ type: 'launchNoVersionInstalled' })
    }
    const javaRec = java.value
    if (!javaRec) {
      throw new LaunchException({ type: 'launchNoProperJava', javaPath: '' })
    }

    let yggdrasilAgent: LaunchOptions['yggdrasilAgent']

    const authority = tryParseUrl(userProfile.value.authority)
    if (authority && (authority.protocol === 'http:' || authority?.protocol === 'https:' || userProfile.value.authority === AUTHORITY_DEV)) {
      launchingStatus.value = 'preparing-authlib'
      yggdrasilAgent = {
        jar: await getOrInstallAuthlibInjector(),
        server: userProfile.value.authority,
      }
    }

    const inst = instance.value
    const assignMemory = inst.assignMemory ?? globalAssignMemory.value
    const hideLauncher = inst.hideLauncher ?? globalHideLauncher.value
    const showLog = inst.showLog ?? globalShowLog.value
    const fastLaunch = inst.fastLaunch ?? globalFastLaunch.value

    let minMemory: number | undefined = inst.minMemory ?? globalMinMemory.value
    let maxMemory: number | undefined = inst.maxMemory ?? globalMaxMemory.value
    if (assignMemory === true && minMemory > 0) {
      // noop
    } else if (assignMemory === 'auto') {
      launchingStatus.value = 'assigning-memory'
      const mem = await getMemoryStatus()
      minMemory = Math.floor(mem.free / 1024 / 1024 - 256)
    } else {
      minMemory = undefined
    }
    maxMemory = assignMemory === true && maxMemory > 0 ? maxMemory : undefined

    const vmOptions = inst.vmOptions ?? globalVmOptions.value.filter(v => !!v)
    const mcOptions = inst.mcOptions ?? globalMcOptions.value.filter(v => !!v)

    const options: LaunchOptions = {
      version: instance.value.version || ver.id,
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
    }
    return options
  }

  async function launchGame() {
    try {
      error.value = undefined
      const options = await generateLaunchOptions()

      if (!options.skipAssetsCheck) {
        launchingStatus.value = 'refreshing-user'
        try {
          await refreshUser(userProfile.value.id)
        } catch (e) {
        }
      }

      launchingStatus.value = 'spawning-process'
      const pid = await launch(options)
      if (pid) {
        data.value?.push({
          pid,
          ready: false,
          options,
        })
      }
    } catch (e) {
      console.error(e)
      error.value = e as any
    } finally {
      launchingStatus.value = ''
    }
  }

  async function killGame() {
    if (launchingStatus.value === 'refreshing-user') {
      abortRefresh()
    }
    if (launchingStatus.value === 'preparing-authlib') {
      abortAuthlibInjectorInstall()
    }
    if (data.value) {
      for (const p of data.value) {
        await kill(p.pid)
      }
    }
  }

  watch(launchingStatus, (v) => console.log(v))

  return {
    launch: launchGame,
    kill: killGame,
    windowReady,
    error,
    count,
    launching,
    generateLaunchOptions,
  }
}
