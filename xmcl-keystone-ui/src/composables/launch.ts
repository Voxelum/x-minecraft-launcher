import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { AUTHORITY_DEV, AuthlibInjectorServiceKey, BaseServiceKey, LaunchOptions, LaunchServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { DialogKey } from './dialog'
import { kInstance } from './instance'
import { kInstanceJava } from './instanceJava'
import { kInstanceVersion } from './instanceVersion'
import { useGlobalSettings } from './setting'
import { kUserContext } from './user'

export const LaunchStatusDialogKey: DialogKey<void> = 'launch-status'

export enum LaunchErrorCode {
  NO_VERSION = 'NO_VERSION',
  NO_JAVA = 'NO_JAVA',
}

export function useLaunchOption() {
  const { globalAssignMemory, globalMaxMemory, globalMinMemory, globalMcOptions, globalVmOptions, globalFastLaunch, globalHideLauncher, globalShowLog } = useGlobalSettings()
  const { path, instance } = injection(kInstance)
  const { resolvedVersion } = injection(kInstanceVersion)
  const { java } = injection(kInstanceJava)
  const { userProfile } = injection(kUserContext)
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
      throw LaunchErrorCode.NO_VERSION
    }
    const javaRec = java.value
    if (!javaRec) {
      throw LaunchErrorCode.NO_JAVA
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
      gameDirectory: path.value,
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

export function useLaunch() {
  const { refreshUser } = useService(UserServiceKey)
  const { launch } = useService(LaunchServiceKey)
  const { userProfile } = injection(kUserContext)
  const { generateLaunchOptions } = useLaunchOption()
  const { launching, launchError } = injection(kLaunchStatus)

  async function launchGame() {
    try {
      launching.value = true
      const options = await generateLaunchOptions()

      if (!options.skipAssetsCheck) {
        try {
          await refreshUser(userProfile.value.id)
        } catch (e) {
        }
      }
      await launch(options)
    } catch (e) {
      if (e instanceof Error) {

      }
    } finally {
      launching.value = false
    }
  }
  return launchGame
}
