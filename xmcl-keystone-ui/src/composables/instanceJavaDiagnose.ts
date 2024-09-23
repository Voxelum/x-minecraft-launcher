import { injection } from '@/util/inject'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { JavaCompatibleState, kInstanceJava } from './instanceJava'
import { JavaIssueDialogKey } from './java'
import { LaunchMenuItem } from './launchButton'

export function useInstanceJavaDiagnose() {
  const { t } = useI18n()
  const { status: java } = injection(kInstanceJava)
  const item: Ref<LaunchMenuItem | undefined> = computed(() => {
    const stat = java.value
    if (!stat) return undefined

    if (stat.javaPath) {
      if (!stat.java?.valid) {
        return {
          title: t('diagnosis.invalidJava.name'),
          description: t('diagnosis.invalidJava.message'),
          color: 'warning',
          onClick: () => {
            showJavaDialog()
          },
        }
      }
      if ('compatible' in stat && stat.compatible !== JavaCompatibleState.Matched) {
        return {
          title: t('diagnosis.incompatibleJava.name', { version: stat.preference.requirement, javaVersion: stat.java.version || '' }),
          description: t('diagnosis.incompatibleJava.message'),
          color: 'warning',
          onClick: () => {
            showJavaDialog()
          },
        }
      }
    }

    return undefined
  })
  const { show: showJavaDialog } = useDialog(JavaIssueDialogKey)

  return {
    issue: item,
  }
}
