import { JavaRecord } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { JavaRecommendation } from './instanceJava'
import { JavaIssueDialogKey } from './java'
import { LaunchMenuItem } from './launchButton'

export const kInstanceJavaDiagnose: InjectionKey<ReturnType<typeof useInstanceJavaDiagnose>> = Symbol('InstanceJavaDiagnose')

export function useInstanceJavaDiagnose(all: Ref<JavaRecord[]>, java: Ref<JavaRecord | undefined>, javaRecommendation: Ref<JavaRecommendation | undefined>) {
  const { t } = useI18n()
  const issue: Ref<LaunchMenuItem | undefined> = computed(() => {
    if (all.value.length === 0) {
      return {
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      }
    }
    if (javaRecommendation.value) {
      return {
        title: t('diagnosis.incompatibleJava.name', { version: javaRecommendation.value.version, javaVersion: javaRecommendation.value.requirement }),
        description: t('diagnosis.incompatibleJava.message'),
      }
    }
    if (!java.value) {
      return {
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      }
    }
  })
  const { show: showJavaDialog } = useDialog(JavaIssueDialogKey)

  function fix() {
    if (issue.value) {
      showJavaDialog()
    }
  }

  return {
    issue,
    fix,
  }
}
