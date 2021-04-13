import { computed, inject, InjectionKey, provide, Ref, ref } from '@vue/composition-api'
import type { FileFilter } from 'electron'
import { useI18n } from '/@/hooks'

export type DialogNames = 'task' | 'java-wizard' | 'login' | 'detail' | ''
| 'user-service'
| 'log' | 'feedback'
| 'launch-status' | 'launch-blocked'

export const DIALOG_SYMBOL: InjectionKey<Ref<DialogNames>> = Symbol('ShowingDialog')
export const DIALOG_LOGIN_SWITCH_USER: InjectionKey<Ref<boolean>> = Symbol('SwitchingUser')
export const DIALOG_JAVA_ISSUE: InjectionKey<Ref<'incompatible' | 'missing'>> = Symbol('JavaIssue')

export function useZipFilter () {
  const { $t } = useI18n()
  const zipFilter: FileFilter = {
    extensions: ['zip'],
    name: $t('zip'),
  }
  return zipFilter
}

export function provideDialog () {
  provide(DIALOG_SYMBOL, ref(''))
  provide(DIALOG_LOGIN_SWITCH_USER, ref(false))
  provide(DIALOG_JAVA_ISSUE, ref('missing'))
}

/**
 * Use a shared dialog between pages
 */
export function useDialog (dialogName: DialogNames = '') {
  const shownDialog: Ref<DialogNames> = inject(DIALOG_SYMBOL) as any
  if (!shownDialog) throw new Error('This should not happened')
  const isShown = computed({
    get: () => shownDialog.value === dialogName,
    set: (v: boolean) => { shownDialog.value = v ? dialogName : '' },
  })
  function hide () {
    if (shownDialog.value === dialogName) {
      shownDialog.value = ''
    }
  }
  function show () {
    if (shownDialog.value !== dialogName) {
      shownDialog.value = dialogName
    }
  }
  return {
    dialog: shownDialog,
    show,
    hide,
    isShown,
  }
}

export function useSingleDialog (isShown = ref(false)) {
  const show = () => { isShown.value = true }
  const hide = () => { isShown.value = false }
  return {
    isShown,
    show,
    hide,
  }
}

export function useLoginDialog () {
  const isSwitchingUser = inject(DIALOG_LOGIN_SWITCH_USER)
  if (!isSwitchingUser) throw new Error('This should not happen')
  return { isSwitchingUser, ...useDialog('login') }
}

export function useJavaWizardDialog () {
  const javaIssue = inject(DIALOG_JAVA_ISSUE)
  if (!javaIssue) throw new Error('This should not happen')
  return { javaIssue, ...useDialog('java-wizard') }
}
