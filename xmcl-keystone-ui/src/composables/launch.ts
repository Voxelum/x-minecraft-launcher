import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { ResolvedVersion } from '@xmcl/core'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, BaseServiceKey, Instance, JavaRecord, LaunchException, LaunchOptions, LaunchServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { DialogKey } from './dialog'
import { useGlobalSettings, useSettingsState } from './setting'

export const LaunchStatusDialogKey: DialogKey<boolean> = 'launch-status'

export enum LaunchErrorCode {
  NO_VERSION = 'NO_VERSION',
  NO_JAVA = 'NO_JAVA',
}

export function useLaunchOption(instance: Ref<Instance>, resolvedVersion: Ref<ResolvedVersion | { requirements: Record<string, any> } | undefined>, java: Ref<JavaRecord | undefined>, userProfile: Ref<UserProfile>, globalState: ReturnType<typeof useSettingsState>) {
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalMcOptions, globalVmOptions, globalFastLaunch, globalHideLauncher, globalShowLog } = useGlobalSettings(globalState)
  const { getMemoryStatus } = useService(BaseServiceKey)
  const { getOrInstallAuthlibInjector } = useService(AuthlibInjectorServiceKey)

  function tryParseUrl(url: string) {
    try {
      return new URL(url)
    } catch {
      return undefined
    }
  }

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
    if (authority && (authority.protocol === 'http:' || authority?.protocol === 'https:' || authority.toString() === AUTHORITY_DEV)) {
      yggdrasilAgent = {
        jar: await getOrInstallAuthlibInjector(),
        server: authority.toString(),
      }
    }

    const inst = instance.value
    const assignMemory = inst.assignMemory ?? globalAssignMemory.value
    const hideLauncher = inst.hideLauncher ?? globalHideLauncher.value
    const showLog = inst.showLog ?? globalShowLog.value
    const fastLaunch = inst.fastLaunch ?? globalFastLaunch.value

    let minMemory: number | undefined = inst.minMemory ?? globalMinMemory.value
    let maxMemory: number | undefined = inst.maxMemory ?? globalMaxMemory.value
    minMemory = assignMemory === true && minMemory > 0
      ? minMemory
      : assignMemory === 'auto' ? Math.floor((await getMemoryStatus()).free / 1024 / 1024 - 256) : undefined
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

  return { generateLaunchOptions }
}

export function useLaunchStatus() {
  const launching = ref(false)
  const launchCount = ref(0)
  const launchError = ref<LaunchErrorCode | undefined>(undefined)

  const { on } = useService(LaunchServiceKey)

  on('minecraft-start', () => {
    launchCount.value++
  })
  on('minecraft-exit', () => {
    launchCount.value--
  })

  return {
    launching,
    launchCount,
    launchError,
  }
}

export const kLaunchStatus: InjectionKey<ReturnType<typeof useLaunchStatus>> = Symbol('LaunchStatus')
