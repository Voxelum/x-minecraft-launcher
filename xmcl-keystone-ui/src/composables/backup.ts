import {
  AutoBackupConfig,
  AutoBackupFileEntry,
  AutoBackupStatusEvent,
  BackupManifest,
  BackupOptions,
  BackupProgress,
  BackupServiceKey,
  RestoreBackupOptions,
  RestoreBackupResult,
  RestoreProgress,
} from '@xmcl/runtime-api'
import { onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatBackupError } from './backupError'
import { useNotifier } from './notifier'
import { useService } from './service'

export function useBackup() {
  const service = useService(BackupServiceKey)
  const {
    cancelBackupOperation: cancelBackupOperationApi,
    createBackup: createBackupApi,
    loadBackupManifest: loadManifestApi,
    restoreBackup: restoreBackupApi,
    getAutoBackupConfig: getAutoBackupConfigApi,
    setAutoBackupConfig: setAutoBackupConfigApi,
    runAutoBackupNow: runAutoBackupNowApi,
    listAutoBackups: listAutoBackupsApi,
    deleteAutoBackup: deleteAutoBackupApi,
    on,
  } = service
  const { notify } = useNotifier()
  const { t } = useI18n()

  let manifestGeneration = 0
  let disposed = false
  const isCreating = ref(false)
  const isRestoring = ref(false)
  const isLoadingManifest = ref(false)
  const backupProgress = ref<BackupProgress | null>(null)
  const restoreProgress = ref<RestoreProgress | null>(null)

  const autoBackupConfig = ref<AutoBackupConfig | null>(null)
  const isAutoBackupRunning = ref(false)
  const autoBackupFiles = ref<AutoBackupFileEntry[]>([])

  const onBackupProgress = (progress: BackupProgress) => {
    if (!disposed) backupProgress.value = progress
  }

  const onRestoreProgress = (progress: RestoreProgress) => {
    if (!disposed) restoreProgress.value = progress
  }

  const onAutoBackupStatus = async (status: AutoBackupStatusEvent) => {
    if (disposed) return
    isAutoBackupRunning.value = status.running
    autoBackupConfig.value = status.config
    if (!status.running) {
      await refreshAutoBackupFiles()
    }
  }

  on('backup-progress', onBackupProgress)
  on('restore-progress', onRestoreProgress)
  on('auto-backup-status', onAutoBackupStatus)

  onScopeDispose(() => {
    disposed = true
    manifestGeneration++
    service.removeListener('backup-progress', onBackupProgress)
    service.removeListener('restore-progress', onRestoreProgress)
    service.removeListener('auto-backup-status', onAutoBackupStatus)
  })

  async function refreshAutoBackupFiles() {
    try {
      const files = await listAutoBackupsApi()
      if (!disposed) autoBackupFiles.value = files
    } catch {
      // Ignore error loading file list
    }
  }

  async function loadAutoBackupState() {
    try {
      const config = await getAutoBackupConfigApi()
      if (disposed) return
      autoBackupConfig.value = config
      await refreshAutoBackupFiles()
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.autoBackupError'),
        body: e?.message || String(e),
      })
    }
  }

  async function updateAutoBackupConfig(patch: Partial<AutoBackupConfig>) {
    try {
      const updated = await setAutoBackupConfigApi(patch)
      autoBackupConfig.value = updated
      await refreshAutoBackupFiles()
      return updated
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.autoBackupError'),
        body: e?.message || String(e),
      })
      throw e
    }
  }

  async function triggerAutoBackupNow() {
    if (isAutoBackupRunning.value || isCreating.value || isRestoring.value) return
    isAutoBackupRunning.value = true
    try {
      const created = await runAutoBackupNowApi()
      await loadAutoBackupState()
      return created
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.autoBackupError'),
        body: e?.message || String(e),
      })
      throw e
    } finally {
      isAutoBackupRunning.value = false
    }
  }

  async function removeAutoBackupFile(filePath: string) {
    try {
      await deleteAutoBackupApi(filePath)
      await refreshAutoBackupFiles()
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.autoBackupError'),
        body: e?.message || String(e),
      })
    }
  }

  async function createBackup(options: BackupOptions): Promise<string> {
    if (isCreating.value || isRestoring.value || isAutoBackupRunning.value) throw new Error(t('backup.preparing'))
    isCreating.value = true
    backupProgress.value = {
      phase: 'preparing',
      percent: 0,
      message: t('backup.preparing'),
    }
    try {
      const dest = await createBackupApi(options)
      return dest
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.createError'),
        body: e?.message || String(e),
      })
      throw e
    } finally {
      isCreating.value = false
    }
  }

  async function loadBackupManifest(path: string): Promise<BackupManifest> {
    const generation = ++manifestGeneration
    isLoadingManifest.value = true
    try {
      return await loadManifestApi(path)
    } catch (e: any) {
      if (!disposed && generation === manifestGeneration) notify({
        level: 'error',
        title: t('backup.loadManifestError'),
        body: e?.message || String(e),
      })
      throw e
    } finally {
      if (generation === manifestGeneration) isLoadingManifest.value = false
    }
  }

  async function restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult> {
    if (isRestoring.value || isCreating.value || isAutoBackupRunning.value) throw new Error(t('backup.preparing'))
    isRestoring.value = true
    restoreProgress.value = {
      phase: 'reading',
      percent: 0,
      message: t('backup.preparing'),
    }
    try {
      const result = await restoreBackupApi(options)
      return result
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.restoreError'),
        body: [formatBackupError(e).message, formatBackupError(e).recoveryPath].filter(Boolean).join('\n'),
      })
      throw e
    } finally {
      isRestoring.value = false
    }
  }

  return {
    isCreating,
    isRestoring,
    isLoadingManifest,
    backupProgress,
    restoreProgress,
    autoBackupConfig,
    isAutoBackupRunning,
    autoBackupFiles,
    cancelBackupOperation: cancelBackupOperationApi,
    createBackup,
    loadBackupManifest,
    restoreBackup,
    loadAutoBackupState,
    updateAutoBackupConfig,
    triggerAutoBackupNow,
    removeAutoBackupFile,
  }
}

