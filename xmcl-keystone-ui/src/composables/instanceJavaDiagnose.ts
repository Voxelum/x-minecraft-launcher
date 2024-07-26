import { injection } from '@/util/inject'
import { InstanceServiceKey, JavaServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { kInstanceJava } from './instanceJava'
import { JavaIssueDialogKey } from './java'
import { LaunchMenuItem } from './launchButton'
import { useNotifier } from './notifier'
import { useService } from './service'
import { kInstances } from './instances'

export function useInstanceJavaDiagnose() {
  const { t } = useI18n()
  const { subscribeTask } = useNotifier()
  const { status: java, error } = injection(kInstanceJava)
  const { installDefaultJava } = useService(JavaServiceKey)
  const { instances } = injection(kInstances)
  const { editInstance } = useService(InstanceServiceKey)
  const item: Ref<LaunchMenuItem | undefined> = computed(() => {
    const stat = java.value
    // if (error.value) {
    //   return {
    //     title: error.value.name,
    //     description: error.value.message,
    //   }
    // }

    if (!stat) return undefined

    if (stat.noJava) {
      return {
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      }
    }
    if (!stat.java?.valid) {
      return {
        title: t('diagnosis.invalidJava.name'),
        description: t('diagnosis.invalidJava.message'),
      }
    }
    if (stat.recomendation) {
      return {
        title: t('diagnosis.incompatibleJava.name', { version: stat.recomendation.requirement, javaVersion: stat.recomendation.selectedJava?.version || '' }),
        description: t('diagnosis.incompatibleJava.message'),
        color: 'warning',
        onClick: () => {
          showJavaDialog()
        },
      }
    }
    return undefined
  })
  const { show: showJavaDialog } = useDialog(JavaIssueDialogKey)

  function fix() {
    const stat = java.value
    if (!stat) {
      return
    }
    const recommendation = stat.recomendation
    if (recommendation &&
      recommendation.recommendedLevel &&
      recommendation.recommendedLevel >= 1 &&
      recommendation.recommendedDownload) {
      const promise = installDefaultJava(recommendation.recommendedDownload)
      subscribeTask(promise.then((java) => {
        const inst = instances.value.find(i => i.path === stat.instance)
        if (java && stat.javaPath === inst?.java) {
          return editInstance({
            instancePath: stat.instance,
            java: java.path,
          })
        }
      }), t('java.modifyInstance'))
      return promise
    } else {
      showJavaDialog()
    }
  }

  return {
    issue: item,
    fix,
  }
}
