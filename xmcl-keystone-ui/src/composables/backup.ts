import {
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
  const { createBackup: createBackupApi, loadBackupManifest: loadManifestApi, restoreBackup: restoreBackupApi, on } = service
  const { notify } = useNotifier()
  const { t } = useI18n()

  const isCreating = ref(false)
  const isRestoring = ref(false)
  const isLoadingManifest = ref(false)
  const backupProgress = ref<BackupProgress | null>(null)
  const restoreProgress = ref<RestoreProgress | null>(null)

  on('backup-progress', (progress: BackupProgress) => {
    backupProgress.value = progress
  })

  on('restore-progress', (progress: RestoreProgress) => {
    restoreProgress.value = progress
  })

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
      notify({
        level: 'success',
        title: t('backup.restoreSuccess'),
        body: t('backup.restoreSuccessDetails', { count: result.restoredInstances.length }),
      })
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
    createBackup,
    loadBackupManifest,
    restoreBackup,
  }
}

