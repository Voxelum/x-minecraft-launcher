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
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotifier } from './notifier'
import { useService } from './service'

export function useBackup() {
  const service = useService(BackupServiceKey)
  const {
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

  const isCreating = ref(false)
  const isRestoring = ref(false)
  const isLoadingManifest = ref(false)
  const backupProgress = ref<BackupProgress | null>(null)
  const restoreProgress = ref<RestoreProgress | null>(null)

  const autoBackupConfig = ref<AutoBackupConfig | null>(null)
  const isAutoBackupRunning = ref(false)
  const autoBackupFiles = ref<AutoBackupFileEntry[]>([])

  on('backup-progress', (progress: BackupProgress) => {
    backupProgress.value = progress
  })

  on('restore-progress', (progress: RestoreProgress) => {
    restoreProgress.value = progress
  })

  on('auto-backup-status', async (status: AutoBackupStatusEvent) => {
    isAutoBackupRunning.value = status.running
    autoBackupConfig.value = status.config
    if (!status.running) {
      await refreshAutoBackupFiles()
    }
  })

  async function refreshAutoBackupFiles() {
    try {
      autoBackupFiles.value = await listAutoBackupsApi()
    } catch {
      // Ignore error loading file list
    }
  }

  async function loadAutoBackupState() {
    try {
      autoBackupConfig.value = await getAutoBackupConfigApi()
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

  async function createBackup(options: BackupOptions): Promise<string | undefined> {
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
    isLoadingManifest.value = true
    try {
      return await loadManifestApi(path)
    } catch (e: any) {
      notify({
        level: 'error',
        title: t('backup.loadManifestError'),
        body: e?.message || String(e),
      })
      throw e
    } finally {
      isLoadingManifest.value = false
    }
  }

  async function restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult> {
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
        body: e?.message || String(e),
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
    createBackup,
    loadBackupManifest,
    restoreBackup,
    loadAutoBackupState,
    updateAutoBackupConfig,
    triggerAutoBackupNow,
    removeAutoBackupFile,
  }
}

