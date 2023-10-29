import { useService } from '@/composables'
import { ResolvedVersion } from '@xmcl/core'
import { Instance, JavaRecord, LaunchServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { LaunchErrorCode, useLaunchOption } from './launch'
import { useSettingsState } from './setting'
import useSWRV from 'swrv'

export const kInstanceLaunch: InjectionKey<ReturnType<typeof useInstanceLaunch>> = Symbol('InstanceLaunch')

export function useInstanceLaunch(instance: Ref<Instance>, resolvedVersion: Ref<ResolvedVersion | { requirements: Record<string, any> } | undefined>, java: Ref<JavaRecord | undefined>, userProfile: Ref<UserProfile>, globalState: ReturnType<typeof useSettingsState>) {
  const { refreshUser } = useService(UserServiceKey)
  const { launch, kill, on, getGameProcesses } = useService(LaunchServiceKey)
  const { generateLaunchOptions } = useLaunchOption(instance, resolvedVersion, java, userProfile, globalState)
  const launching = ref(false)
  const error = ref<any | undefined>(undefined)

  const { data, mutate } = useSWRV(`/${instance.value.path}/games`, async () => {
    const processes = await getGameProcesses()
    const filtered = processes.filter(p => p.options.gameDirectory === instance.value.path)
    return filtered
  })
  watch(instance, () => {
    mutate()
  })
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

  async function launchGame() {
    try {
      launching.value = true
      error.value = undefined
      const options = await generateLaunchOptions()

      if (!options.skipAssetsCheck) {
        try {
          await refreshUser(userProfile.value.id)
        } catch (e) {
        }
      }
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
      launching.value = false
    }
  }

  async function killGame() {
    if (data.value) {
      for (const p of data.value) {
        await kill(p.pid)
      }
    }
  }

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
