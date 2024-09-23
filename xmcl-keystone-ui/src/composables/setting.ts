import { useService, useServiceBusy } from '@/composables'
import { injection } from '@/util/inject'
import { BaseServiceKey, Environment, Settings } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCacheBool } from './cache'
import { useState } from './syncableState'
import { useEnvironment } from './environment'

export function useUpdateSettings() {
  const { checkUpdate } = useService(BaseServiceKey)
  const env: Ref<Environment | undefined> = useEnvironment()
  const { state } = injection(kSettingsState)
  const updateStatus = computed(() => state.value?.updateStatus)
  const checkingUpdate = useServiceBusy(BaseServiceKey, 'checkUpdate')
  const downloadingUpdate = useServiceBusy(BaseServiceKey, 'downloadUpdate')
  const updateInfo = computed(() => state.value?.updateInfo)
  const version = computed(() => env.value?.version ?? '0.0.0')

  return {
    version,
    checkUpdate,
    updateStatus,
    checkingUpdate,
    downloadingUpdate,
    updateInfo,
  }
}
export const kSettingsState: InjectionKey<ReturnType<typeof useSettingsState>> = Symbol('Settings')

export function useSettingsState() {
  const { getSettings } = useService(BaseServiceKey)
  return useState(getSettings, Settings)
}

export function useGlobalSettings({ state } = injection(kSettingsState)) {
  const globalAssignMemory = computed(() => state.value?.globalAssignMemory ?? false)
  const globalMinMemory = computed(() => state.value?.globalMinMemory ?? 0)
  const globalMaxMemory = computed(() => state.value?.globalMaxMemory ?? 0)
  const globalVmOptions = computed(() => state.value?.globalVmOptions ?? [])
  const globalMcOptions = computed(() => state.value?.globalMcOptions ?? [])
  const globalFastLaunch = computed(() => state.value?.globalFastLaunch ?? false)
  const globalHideLauncher = computed(() => state.value?.globalHideLauncher ?? false)
  const globalShowLog = computed(() => state.value?.globalShowLog ?? false)
  const globalDisableAuthlibInjector = computed(() => state.value?.globalDisableAuthlibInjector ?? true)
  const globalDisableElyByAuthlib = computed(() => state.value?.globalDisableElyByAuthlib ?? false)
  const globalPrependCommand = computed(() => state.value?.globalPrependCommand ?? '')
  const setGlobalSettings = (setting: {
    globalMinMemory: number
    globalMaxMemory: number
    globalAssignMemory: boolean | 'auto'
    globalVmOptions: string[]
    globalMcOptions: string[]
    globalFastLaunch: boolean
    globalHideLauncher: boolean
    globalShowLog: boolean
    globalDisableAuthlibInjector: boolean
    globalDisableElyByAuthlib: boolean
    globalPrependCommand: string
  }) => {
    state.value?.globalInstanceSetting(setting)
  }

  return {
    globalAssignMemory,
    globalMinMemory,
    globalMaxMemory,
    globalVmOptions,
    globalMcOptions,
    globalFastLaunch,
    globalHideLauncher,
    globalShowLog,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalPrependCommand,
    setGlobalSettings,
  }
}
export function useGameDirectory() {
  const { getGameDataDirectory, migrate, openDirectory } = useService(BaseServiceKey)
  const root = ref('')
  onMounted(() => {
    getGameDataDirectory().then((r) => {
      root.value = r
    })
  })
  const setGameDirectory = async (value: string) => {
    root.value = value
    await migrate({ destination: value })
  }

  function showGameDirectory() {
    if (root.value) {
      openDirectory(root.value)
    }
  }
  return {
    root,
    setGameDirectory,
    showGameDirectory,
  }
}

export function useSettings() {
  const streamerMode = inject('streamerMode', useLocalStorageCacheBool('streamerMode', false))
  const { state, error, isValidating } = injection(kSettingsState)

  const getProxy = () => {
    const proxy = state.value?.httpProxy || ''
    try {
      const url = new URL(proxy)
      return {
        host: url.hostname,
        port: url.port,
      }
    } catch (e) {
      return {
        host: '',
        port: '',
      }
    }
  }

  const locales = computed(() => state.value?.locales || [])
  const selectedLocale = computed({
    get: () => locales.value.find(l => l.locale === state.value?.locale)?.locale || 'en',
    set: v => state.value?.localeSet(v),
  })
  const enableDedicatedGPUOptimization = computed({
    get: () => state.value?.enableDedicatedGPUOptimization ?? false,
    set: v => state.value?.enableDedicatedGPUOptimizationSet(v),
  })
  const apiSetsPreference = computed({
    get: () => state.value?.apiSetsPreference ?? '',
    set: v => state.value?.apiSetsPreferenceSet(v),
  })
  const replaceNative = computed({
    get: () => state.value?.replaceNatives ?? 'legacy-only' as string | false,
    set: v => state.value?.replaceNativesSet(v as any),
  })
  const maxSockets = ref(state.value?.maxSockets)
  const maxAPISockets = ref(state.value?.maxAPISockets)
  const proxy = ref(getProxy())
  const httpProxyEnabled = computed({
    get: () => state.value?.httpProxyEnabled ?? false,
    set: v => state.value?.httpProxyEnabledSet(v),
  })
  const developerMode = computed({
    get: () => state.value?.developerMode ?? false,
    set: v => state.value?.developerModeSet(v),
  })
  const disableTelemetry = computed({
    get: () => state.value?.disableTelemetry ?? false,
    set: v => state.value?.disableTelemetrySet(v),
  })
  const enableDiscord = computed({
    get: () => state.value?.discordPresence ?? false,
    set: (v) => state.value?.discordPresenceSet(v),
  })
  const apiSets = computed(() => state.value?.apiSets || [])

  onMounted(() => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  watch(computed(() => state.value?.httpProxy), () => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  onUnmounted(() => {
    const p = proxy.value
    const newValue =
      !p.host && !p.port
        ? ''
        : `http://${p.host}:${p.port}`
    if (newValue !== state.value?.httpProxy) {
      state.value?.httpProxySet(newValue)
    }
    if (state.value?.maxSockets !== maxSockets.value) {
      state.value?.maxSocketsSet(Number(maxSockets.value))
    }
    if (state.value?.maxAPISockets !== maxAPISockets.value) {
      state.value?.maxAPISocketsSet(Number(maxAPISockets.value))
    }
  })

  return {
    enableDedicatedGPUOptimization,
    streamerMode,
    developerMode,
    httpProxyEnabled,
    enableDiscord,
    maxSockets,
    maxAPISockets,
    locales,
    proxy,
    replaceNative,
    selectedLocale,
    apiSetsPreference,
    apiSets,
    disableTelemetry,
    error,
    isValidating,
  }
}
