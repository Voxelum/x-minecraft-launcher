import { JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { JavaCompatibleState, JavaRecommendation } from './instanceJava'
import { JavaIssueDialogKey } from './java'
import { LaunchMenuItem } from './launchButton'
import { useNotifier } from './notifier'
import { useService } from './service'

export const kInstanceJavaDiagnose: InjectionKey<ReturnType<typeof useInstanceJavaDiagnose>> = Symbol('InstanceJavaDiagnose')

export function useInstanceJavaDiagnose(all: Ref<JavaRecord[]>, java: Ref<JavaRecord | undefined>, javaRecommendation: Ref<JavaRecommendation | undefined>) {
  const { t } = useI18n()
  const { subscribeTask } = useNotifier()
  const { installDefaultJava } = useService(JavaServiceKey)
  const issue: Ref<LaunchMenuItem | undefined> = computed(() => {
    if (all.value.length === 0) {
      return {
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      }
    }
    if (!java.value) {
      return {
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      }
    }
    if (javaRecommendation.value) {
      if (javaRecommendation.value.recommendedLevel && javaRecommendation.value.recommendedLevel >= 1 &&
        javaRecommendation.value.recommendedDownload) {
        return {
          title: t('diagnosis.incompatibleJava.name', { version: javaRecommendation.value.requirement, javaVersion: javaRecommendation.value.selectedJava?.version || '' }),
          description: t('diagnosis.incompatibleJava.message'),
        }
      }
      return {
        title: t('diagnosis.incompatibleJava.name', { version: javaRecommendation.value.requirement, javaVersion: javaRecommendation.value.selectedJava?.version || '' }),
        description: t('diagnosis.incompatibleJava.message'),
        color: 'warning',
        onClick: () => {
          showJavaDialog()
        },
      }
    }
  })
  const { show: showJavaDialog } = useDialog(JavaIssueDialogKey)

  function fix() {
    if (issue.value) {
      if (javaRecommendation.value && javaRecommendation.value.recommendedLevel && javaRecommendation.value.recommendedLevel >= 1 &&
        javaRecommendation.value.recommendedDownload) {
        const promise = installDefaultJava(javaRecommendation.value.recommendedDownload)
        subscribeTask(promise, t('java.modifyInstance'))
        return promise
      } else {
        showJavaDialog()
      }
    }
  }

  return {
    issue,
    fix,
  }
}
