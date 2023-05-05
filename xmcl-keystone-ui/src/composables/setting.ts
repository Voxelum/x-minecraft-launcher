import { useService, useServiceBusy } from '@/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useLocalStorageCacheBool } from './cache'

export function useUpdateSettings() {
  const { state, checkUpdate } = useService(BaseServiceKey)

  const updateStatus = computed(() => state.updateStatus)
  const checkingUpdate = useServiceBusy(BaseServiceKey, 'checkUpdate')
  const downloadingUpdate = useServiceBusy(BaseServiceKey, 'downloadUpdate')
  const updateInfo = computed(() => state.updateInfo)

  return {
    checkUpdate,
    updateStatus,
    checkingUpdate,
    downloadingUpdate,
    updateInfo,
  }
}

export function useSettings() {
  const { state } = useService(BaseServiceKey)
  const hideNews = useLocalStorageCacheBool('hideNews', false)

  const getProxy = () => {
    const proxy = state.httpProxy
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

  const root = computed(() => state.root)
  const locales = computed(() => state.locales || [])
  const selectedLocale = computed({
    get: () => locales.value.find(l => l.locale === state.locale)?.locale || 'en',
    set: v => state.localeSet(v),
  })
  const allowPrerelease = computed({
    get: () => state.allowPrerelease,
    set: v => state.allowPrereleaseSet(v),
  })
  const autoInstallOnAppQuit = computed({
    get: () => state.autoInstallOnAppQuit,
    set: v => state.autoInstallOnAppQuitSet(v),
  })
  const autoDownload = computed({
    get: () => state.autoDownload,
    set: v => state.autoDownloadSet(v),
  })
  const apiSetsPreference = computed({
    get: () => state.apiSetsPreference,
    set: v => state.apiSetsPreferenceSet(v),
  })
  const maxSockets = ref(state.maxSockets)
  const maxAPISockets = ref(state.maxAPISockets)
  const proxy = ref(getProxy())
  const httpProxyEnabled = computed({
    get: () => state.httpProxyEnabled,
    set: v => state.httpProxyEnabledSet(v),
  })
  const developerMode = computed({
    get: () => state.developerMode,
    set: v => state.developerModeSet(v),
  })
  const disableTelemetry = computed({
    get: () => state.disableTelemetry,
    set: v => state.disableTelemetrySet(v),
  })
  const enableDiscord = computed({
    get: () => state.discordPresence,
    set: (v) => state.discordPresenceSet(v),
  })
  const apiSets = computed(() => state.apiSets)

  onMounted(() => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  watch(computed(() => state.httpProxy), () => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  onUnmounted(() => {
    const p = proxy.value
    const newValue = `http://${p.host}:${p.port}`
    if (newValue !== state.httpProxy) {
      state.httpProxySet(`http://${p.host}:${p.port}`)
    }
    if (state.maxSockets !== maxSockets.value) {
      state.maxSocketsSet(Number(maxSockets.value))
    }
    if (state.maxAPISockets !== maxAPISockets.value) {
      state.maxAPISocketsSet(Number(maxAPISockets.value))
    }
  })

  return {
    root,
    developerMode,
    httpProxyEnabled,
    enableDiscord,
    maxSockets,
    maxAPISockets,
    locales,
    proxy,
    selectedLocale,
    allowPrerelease,
    autoDownload,
    autoInstallOnAppQuit,
    apiSetsPreference,
    apiSets,
    disableTelemetry,
    hideNews,
  }
}

export function useLauncherVersion() {
  const { state } = useService(BaseServiceKey)
  const version = computed(() => state.version)
  const build = computed(() => state.build)
  return {
    version,
    build,
  }
}
