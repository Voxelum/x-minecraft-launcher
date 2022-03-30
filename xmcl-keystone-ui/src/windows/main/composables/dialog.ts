import { computed, inject, InjectionKey, provide, Ref, ref } from '@vue/composition-api'
import type { JavaVersion } from '@xmcl/core'
import { useI18n } from '/@/composables'
import { injection } from '/@/util/inject'

export const DIALOG_SYMBOL: InjectionKey<{ dialog: Ref<string>; parameter: Ref<any> }> = Symbol('ShowingDialog')
export const DIALOG_JAVA_ISSUE: InjectionKey<Ref<{ type: 'incompatible' | 'missing'; version: JavaVersion }>> = Symbol('JavaIssue')

export function useZipFilter() {
  const { $t } = useI18n()
  const zipFilter = {
    extensions: ['zip'],
    name: $t('zip'),
  }
  return zipFilter
}

export function provideDialog() {
  provide(DIALOG_SYMBOL, { dialog: ref(''), parameter: ref(undefined) })
  provide(DIALOG_JAVA_ISSUE, ref({ type: '', version: { majorVersion: 8, component: 'jre-legacy' } }))
}

export interface DialogKey<T> extends String { }

/**
 * Use a shared dialog between pages
 */
export function useDialog<T>(dialogName: DialogKey<T> = '') {
  const { dialog, parameter } = injection(DIALOG_SYMBOL)
  const isShown = computed({
    get: () => dialog.value === dialogName,
    set: (v: boolean) => { dialog.value = v ? dialogName.toString() : '' },
  })
  function hide() {
    if (dialog.value === dialogName) {
      dialog.value = ''
    }
  }
  function show(param?: T) {
    if (dialog.value !== dialogName) {
      parameter.value = param
      dialog.value = dialogName.toString()
    }
  }
  return {
    dialog,
    parameter: parameter as Ref<T | undefined>,
    show,
    hide,
    isShown,
  }
}

export function useJavaWizardDialog() {
  const javaIssue = inject(DIALOG_JAVA_ISSUE)
  if (!javaIssue) throw new Error('This should not happen')
  return { javaIssue, ...useDialog('java-wizard') }
}
