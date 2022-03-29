import { computed, onMounted, onUnmounted, ref, Ref, watch } from '@vue/composition-api'
import { useBusy } from './useSemaphore'
import { useService } from './useService'
import { BaseServiceKey } from '@xmcl/runtime-api'

export function useBaseService() {
  return useService(BaseServiceKey)
}

export function useSettings() {
  const { state, checkUpdate } = useBaseService()

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

  const locales = computed(() => state.locales || [])
  const selectedLocale = computed({
    get: () => locales.value.find(l => l === state.locale) || 'en',
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
  const proxy = ref(getProxy())
  const httpProxyEnabled = computed({
    get: () => state.httpProxyEnabled,
    set: v => state.httpProxyEnabledSet(v),
  })
  const apiSets = computed(() => ['mojang', ...state.apiSets])
  const updateStatus = computed(() => state.updateStatus)
  const checkingUpdate = useBusy('checkUpdate()')
  const downloadingUpdate = useBusy('downloadUpdate()')
  const updateInfo = computed(() => state.updateInfo)

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
  })

  return {
    checkUpdate,
    httpProxyEnabled,
    locales,
    proxy,
    selectedLocale,
    allowPrerelease,
    autoDownload,
    autoInstallOnAppQuit,
    apiSetsPreference,
    apiSets,
    updateStatus,
    checkingUpdate,
    downloadingUpdate,
    updateInfo,
  }
}

export function useLauncherVersion() {
  const { state } = useBaseService()
  const version = computed(() => state.version)
  const build = computed(() => state.build)
  return {
    version,
    build,
  }
}
