import { computed, InjectionKey, provide, Ref, ref } from 'vue'

import { injection } from '@/util/inject'

export const kDialogModel: InjectionKey<{ dialog: Ref<string>; parameter: Ref<any> }> = Symbol('ShowingDialog')

export function useZipFilter() {
  const { t } = useI18n()
  const zipFilter = reactive({
    extensions: ['zip'],
    name: computed(() => t('extensions.zip')),
  })
  return zipFilter
}

export function useModrinthFilter() {
  const { t } = useI18n()
  const filter = reactive({
    extensions: ['mrpack'],
    name: computed(() => t('extensions.mrpack')),
  })
  return filter
}

export interface DialogModel {
  dialog: Ref<string>
  parameter: Ref<any>
}

export function useDialogModel(): DialogModel {
  return {
    dialog: ref(''),
    parameter: ref(undefined),
  }
}

export interface DialogKey<T> extends String { }

/**
 * Use a shared dialog between pages
 */
export function useDialog<T>(dialogName: DialogKey<T> = '', onShown?: (param: T) => void, onHide?: () => void) {
  const { dialog, parameter } = injection(kDialogModel)
  const isShown = computed({
    get: () => dialog.value === dialogName,
    set: (v: boolean) => {
      if (v) {
        show()
      } else {
        hide()
      }
    },
  })
  function hide() {
    if (dialog.value === dialogName) {
      console.log(`hide ${dialogName}`)
      dialog.value = ''
      parameter.value = undefined
    }
  }
  function show(param?: T) {
    if (dialog.value !== dialogName) {
      console.log(`show ${dialogName}`)
      parameter.value = param
      dialog.value = dialogName.toString()
    }
  }
  watch(isShown, (value) => {
    if (value) {
      onShown?.(parameter.value)
    } else {
      onHide?.()
    }
  })

  return {
    dialog,
    parameter: parameter as Ref<T | undefined>,
    show,
    hide,
    isShown,
  }
}
