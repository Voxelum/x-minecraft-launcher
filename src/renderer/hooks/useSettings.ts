import { computed, Ref } from '@vue/composition-api'
import { UpdateInfo } from 'electron-updater'
import { useStore } from './useStore'
import { useServiceOnly } from './useService'
import { useBusy } from './useSemaphore'
import { BaseServiceKey } from '/@shared/services/BaseService'

export function useSettings () {
  const { state, commit } = useStore()
  const locales = computed(() => state.base.locales || [])
  const selectedLocale = computed({
    get: () => locales.value.find(l => l === state.base.locale) || 'en',
    set: v => commit('locale', v),
  })
  const allowPrerelease = computed({
    get: () => state.base.allowPrerelease,
    set: v => commit('allowPrerelease', v),
  })
  const autoInstallOnAppQuit = computed({
    get: () => state.base.autoInstallOnAppQuit,
    set: v => commit('autoInstallOnAppQuit', v),
  })
  const autoDownload = computed({
    get: () => state.base.autoDownload,
    set: v => commit('autoDownload', v),
  })
  const apiSetsPreference = computed({
    get: () => state.base.apiSetsPreference,
    set: v => commit('apiSetsPreference', v),
  })
  const apiSets = computed(() => ['mojang', ...state.base.apiSets])
  const updateStatus = computed(() => state.base.updateStatus)
  const checkingUpdate = useBusy('checkUpdate')
  const downloadingUpdate = useBusy('downloadUpdate')
  const updateInfo: Ref<UpdateInfo> = computed(() => state.base.updateInfo || {}) as any

  return {
    ...useServiceOnly(BaseServiceKey, 'checkUpdate'),
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

export function useLauncherVersion () {
  const { state } = useStore()
  const version = computed(() => state.base.version)
  const build = computed(() => state.base.build)
  return {
    version,
    build,
  }
}

export function useUpdateInfo () {
  const { state } = useStore()
  const checkingUpdate = useBusy('checkUpdate')
  const downloadingUpdate = useBusy('downloadUpdate')
  const updateInfo = computed(() => state.base.updateInfo)
  const updateStatus = computed(() => state.base.updateStatus)
  return {
    checkingUpdate,
    downloadingUpdate,
    updateInfo,
    updateStatus,
    ...useServiceOnly(BaseServiceKey, 'downloadUpdate', 'quitAndInstall', 'checkUpdate'),
  }
}
