import { useService } from '@/composables'
import { ResolvedVersion } from '@xmcl/core'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, BaseServiceKey, Instance, JavaRecord, LaunchException, LaunchOptions, LaunchServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useGlobalSettings, useSettingsState } from './setting'

export const kInstanceLaunch: InjectionKey<ReturnType<typeof useInstanceLaunch>> = Symbol('InstanceLaunch')

export function useInstanceLaunch(instance: Ref<Instance>, resolvedVersion: Ref<ResolvedVersion | { requirements: Record<string, any> } | undefined>, java: Ref<JavaRecord | undefined>, userProfile: Ref<UserProfile>, globalState: ReturnType<typeof useSettingsState>) {
  const { refreshUser } = useService(UserServiceKey)
  const { launch, kill, on, getGameProcesses, reportOperation } = useService(LaunchServiceKey)
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalMcOptions, globalVmOptions, globalFastLaunch, globalHideLauncher, globalShowLog } = useGlobalSettings(globalState)
  const { getMemoryStatus } = useService(BaseServiceKey)
  const { abortRefresh } = useService(UserServiceKey)
  const { getOrInstallAuthlibInjector, abortAuthlibInjectorInstall } = useService(AuthlibInjectorServiceKey)

  const launchingStatus = ref('' as '' | 'spawning-process' | 'refreshing-user' | 'preparing-authlib' | 'assigning-memory')
  const launching = computed(() => !!launchingStatus.value)

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

  async function generateLaunchOptions(id: string) {
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
        jar: await track(getOrInstallAuthlibInjector(), 'prepare-authlib', id),
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
      const mem = await track(getMemoryStatus(), 'get-memory-status', id)
      minMemory = Math.floor(mem.free / 1024 / 1024 - 256)
    } else {
      minMemory = undefined
    }
    maxMemory = assignMemory === true && maxMemory > 0 ? maxMemory : undefined

    const vmOptions = inst.vmOptions ?? globalVmOptions.value.filter(v => !!v)
    const mcOptions = inst.mcOptions ?? globalMcOptions.value.filter(v => !!v)

    const options: LaunchOptions = {
      operationId: id,
      version: ver.id,
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

  async function _launch(operationId: string) {
    try {
      error.value = undefined
      const options = await generateLaunchOptions(operationId)

      if (!options.skipAssetsCheck) {
        launchingStatus.value = 'refreshing-user'
        try {
          await track(Promise.race([
            new Promise((resolve, reject) => { setTimeout(() => reject(new Error('Timeout')), 5_000) }),
            refreshUser(userProfile.value.id),
          ]), 'refresh-user', operationId)
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

  async function launchWithTracking() {
    const operationId = crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
    await track(_launch(operationId), 'launch', operationId)
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

  return {
    launch: launchWithTracking,
    kill: killGame,
    windowReady,
    error,
    count,
    launching,
    launchingStatus,
    generateLaunchOptions,
  }
}
