import { injection } from '@/util/inject'
import { kInstanceFiles } from './instanceFiles'

export function useInstanceFilesDiagnose() {
  const { t } = useI18n()
  const { instanceInstallStatus, resumeInstall } = injection(kInstanceFiles)

  const issue = computed(() => (instanceInstallStatus.value?.pendingFileCount || 0) > 0
    ? {
      title: t('diagnosis.instanceFiles.title'),
      description: t('diagnosis.instanceFiles.description', { counts: instanceInstallStatus.value?.pendingFileCount }),
    }
    : undefined)
  const fix = async () => {
    if (instanceInstallStatus.value && instanceInstallStatus.value.pendingFileCount > 0) {
      await resumeInstall(instanceInstallStatus.value.instance)
    }
  }

  return {
    issue,
    fix,
  }
}
