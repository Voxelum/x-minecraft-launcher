import { Instance } from '../entities/instance'
import { UserProfile } from '../entities/user.schema'
import { LaunchException, LaunchOptions } from '../services/LaunchService'
import { AUTHORITY_DEV } from './authority'

function tryParseUrl(url: string) {
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

export interface GenerateLaunchOptions {
  token: string
  operationId: string
  side?: 'client' | 'server'
  overrides?: Partial<LaunchOptions>
  dry?: boolean
  javaPath?: string
  globalEnv: Record<string, string>
  globalVmOptions: string[]
  globalMcOptions: string[]
  globalPrependCommand: string
  globalAssignMemory: boolean | 'auto'
  globalMinMemory: number
  globalMaxMemory: number
  globalHideLauncher?: boolean
  globalShowLog?: boolean
  globalFastLaunch?: boolean
  globalDisableAuthlibInjector?: boolean
  globalDisableElyByAuthlib?: boolean
  globalPreExecuteCommand?: string
  globalResolution?: { width?: number; height?: number; fullscreen?: boolean }
  modCount: number
  getOrInstallAuthlibInjector: () => Promise<string>
  track: <T, S = string>(token: string, p: Promise<T>, name: S, id: string) => Promise<T>
}

export async function generateLaunchOptionsWithGlobal(
  inst: Instance,
  userProfile: UserProfile,
  version: string | undefined,
  {
    token,
    operationId,
    side = 'client',
    overrides,
    dry,
    javaPath: _javaPath,
    globalEnv,
    globalVmOptions,
    globalMcOptions,
    globalPrependCommand,
    globalAssignMemory,
    globalMinMemory,
    globalMaxMemory,
    globalHideLauncher,
    globalShowLog,
    globalFastLaunch,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalPreExecuteCommand,
    globalResolution,
    modCount,
    getOrInstallAuthlibInjector,
    track,
  }: GenerateLaunchOptions
) {
  const ver = version

  if (!ver) {
    throw new LaunchException({ type: 'launchNoVersionInstalled' })
  }

  const javaPath = overrides?.java ?? _javaPath
  if (!javaPath) {
    throw new LaunchException({ type: 'launchNoProperJava', javaPath: '' })
  }

  let yggdrasilAgent: LaunchOptions['yggdrasilAgent']

  const authority = tryParseUrl(userProfile.authority)

  const disableAuthlibInjector = inst.disableAuthlibInjector ?? globalDisableAuthlibInjector
  if (
    !disableAuthlibInjector
    && authority
    && (authority.protocol === 'http:' || authority?.protocol === 'https:' || userProfile.authority === AUTHORITY_DEV)
    && !dry
  ) {
    try {
      yggdrasilAgent = {
        jar: await track(token, getOrInstallAuthlibInjector(), 'preparing-authlib', operationId),
        server: userProfile.authority,
      }
    } catch {
      // TODO: notify user
    }
  }

  const assignMemory = inst.assignMemory ?? globalAssignMemory
  const hideLauncher = inst.hideLauncher ?? globalHideLauncher
  const preExecuteCommand = inst.preExecuteCommand ?? globalPreExecuteCommand
  const env = {
    ...globalEnv,
    ...inst.env,
  }
  const showLog = inst.showLog ?? globalShowLog
  const fastLaunch = inst.fastLaunch ?? globalFastLaunch
  const disableElyByAuthlib = inst.disableElybyAuthlib ?? globalDisableElyByAuthlib

  let minMemory: number | undefined = inst.minMemory ?? globalMinMemory
  let maxMemory: number | undefined = inst.maxMemory ?? globalMaxMemory
  if (assignMemory === true && minMemory > 0) {
    // noop
  } else if (assignMemory === 'auto') {
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

  const vmOptions = inst.vmOptions ?? globalVmOptions.filter(v => !!v)
  const mcOptions = inst.mcOptions ?? globalMcOptions.filter(v => !!v)
  const prependCommand = inst.prependCommand ?? globalPrependCommand

  const options: LaunchOptions = {
    operationId,
    version: ver,
    gameDirectory: inst.path,
    user: userProfile,
    java: javaPath,
    hideLauncher,
    env,
    showLog,
    minMemory,
    maxMemory,
    skipAssetsCheck: fastLaunch,
    vmOptions,
    mcOptions,
    yggdrasilAgent,
    disableElyByAuthlib,
    preExecuteCommand,
    prependCommand,
    side,
    resolution: inst.resolution ?? globalResolution,
    server: inst.server ?? undefined,
    ...overrides,
  }
  return options
}