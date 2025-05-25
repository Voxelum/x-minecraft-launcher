import { injection } from '@/util/inject'
import { kInstanceFiles } from './instanceFiles'

export function useInstanceFilesDiagnose() {
  const { t } = useI18n()
  const { instanceInstallStatus, resumeInstall, isResumingInstall, unzipFileNotFound } = injection(kInstanceFiles)

  const issue = computed(() =>
    unzipFileNotFound.value
      ? {
        title: t('diagnosis.unzipFileNotFound.title'),
        description: t('diagnosis.unzipFileNotFound.description', { file: unzipFileNotFound.value }),
      }
      : (instanceInstallStatus.value?.pendingFileCount || 0) > 0
        ? {
          title: t('diagnosis.instanceFiles.title'),
          description: t('diagnosis.instanceFiles.description', { counts: instanceInstallStatus.value?.pendingFileCount }),
        }
        : undefined)
  const fix = async () => {
    if (instanceInstallStatus.value && instanceInstallStatus.value.pendingFileCount > 0) {
      await resumeInstall(instanceInstallStatus.value.instance).catch((e) => {
        if (e.name === '')
          throw e
      })
    }
  }
  const loading = computed(() => instanceInstallStatus.value?.instance ? isResumingInstall(instanceInstallStatus.value?.instance) : false)

  return {
    loading,
    issue,
    fix,
  }
}
