import { injection } from '@/util/inject'
import { kInstanceFiles } from './instanceFiles'

export function useInstanceFilesDiagnose() {
  const { t } = useI18n()
  const { instanceFiles, installFiles } = injection(kInstanceFiles)

  const issue = computed(() => (instanceFiles.value?.files.length || 0) > 0
    ? {
      title: t('diagnosis.instanceFiles.title'),
      description: t('diagnosis.instanceFiles.description', { counts: instanceFiles.value?.files.length }),
    }
    : undefined)
  const fix = () => {
    if (instanceFiles.value) {
      return installFiles(instanceFiles.value.instance, instanceFiles.value.files)
    }
  }

  return {
    issue,
    fix,
  }
}
