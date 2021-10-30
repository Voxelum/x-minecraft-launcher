import { computed, Ref } from '@vue/composition-api'
import { UpdateInfo } from 'electron-updater'
import { useBusy } from './useSemaphore'
import { useService } from './useService'
import { BaseServiceKey } from '/@shared/services/BaseService'

export function useBaseService() {
  return useService(BaseServiceKey)
}

export function useSettings() {
  const { state, checkUpdate } = useBaseService()
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
  const apiSets = computed(() => ['mojang', ...state.apiSets])
  const updateStatus = computed(() => state.updateStatus)
  const checkingUpdate = useBusy('checkUpdate')
  const downloadingUpdate = useBusy('downloadUpdate')
  const updateInfo: Ref<UpdateInfo> = computed(() => state.updateInfo || {}) as any

  return {
    checkUpdate,
    locales,
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

export function useUpdateInfo() {
  const { state, checkUpdate, downloadUpdate, quitAndInstall } = useBaseService()
  const checkingUpdate = useBusy('checkUpdate')
  const downloadingUpdate = useBusy('downloadUpdate')
  const updateInfo = computed(() => state.updateInfo)
  const updateStatus = computed(() => state.updateStatus)
  return {
    checkingUpdate,
    downloadingUpdate,
    updateInfo,
    updateStatus,
    checkUpdate,
    downloadUpdate,
    quitAndInstall,
  }
}
