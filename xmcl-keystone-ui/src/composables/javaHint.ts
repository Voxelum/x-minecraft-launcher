import { injection } from '@/util/inject'
import { JavaCompatibleState, kInstanceJava } from './instanceJava'

export function useJavaHint() {
  const { status } = injection(kInstanceJava)
  const { t } = useI18n()

  const isMissingJava = computed(() => status.value?.noJava)
  const title = computed(() => (!isMissingJava.value
    ? t('HomeJavaIssueDialog.incompatibleJava', { javaVersion: status.value?.java?.version ?? status.value?.javaPath ?? '' })
    : t('HomeJavaIssueDialog.missingJava')))
  const hint = computed(() => (!isMissingJava.value
    ? t('HomeJavaIssueDialog.incompatibleJavaHint', { javaVersion: status.value?.java?.version })
    : t('HomeJavaIssueDialog.missingJavaHint')))
  const needDownloadHint = computed(() => !status.value?.javaVersion)

  const canSwitch = computed(() => status.value?.compatible !== JavaCompatibleState.Matched && status.value?.preferredJava)

  return {
    isMissingJava,
    title,
    hint,
    needDownloadHint,
    canSwitch,
  }
}
