import { computed, InjectionKey, Ref, ref } from 'vue'

import { injection } from '@/util/inject'

export const kDialogModel: InjectionKey<DialogModel> = Symbol('ShowingDialog')

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

export type DialogModel<T = any> = Ref<{
  dialog: string
  parameter: T
}>

export function useDialogModel(): DialogModel {
  const model = shallowRef({ dialog: '', parameter: undefined })
  const channel = new BroadcastChannel('dialog')
  channel.addEventListener('message', (e) => {
    console.log(e)
    if (e.data.dialog === model.value.dialog) return
    model.value = e.data
  })
  watch(model, (value) => {
    channel.postMessage({
      dialog: value.dialog,
      parameter: value.parameter ? JSON.parse(JSON.stringify(value.parameter)) : value.parameter,
    })
  })
  return model
}

export interface DialogKey<T> extends String { }

/**
 * Use a shared dialog between pages
 */
export function useDialog<T = any>(dialogName: DialogKey<T> = '', onShown?: (param: T) => void, onHide?: () => void) {
  const model = injection(kDialogModel)
  const isShown = computed({
    get: () => model.value.dialog === dialogName,
    set: (v: boolean) => {
      if (v) {
        show()
      } else {
        hide()
      }
    },
  })
  function hide() {
    if (model.value.dialog === dialogName) {
      console.log(`hide ${dialogName}`)
      model.value = { dialog: '', parameter: undefined }
    }
  }
  function show(param?: T) {
    if (model.value.dialog !== dialogName) {
      console.log(`show ${dialogName}`)
      model.value = { dialog: dialogName as string, parameter: param }
    }
  }
  watch(isShown, (value) => {
    if (value) {
      onShown?.(model.value.parameter)
    } else {
      onHide?.()
    }
  })

  return {
    dialog: model as DialogModel<T>,
    show,
    hide,
    isShown,
  }
}

export function useSimpleDialog<T>(onConfirm: (target: T | undefined) => void) {
  const target = ref(undefined as T | undefined)
  const model = computed({
    get: () => target.value !== undefined,
    set: (v: boolean) => {
      if (!v) {
        target.value = undefined
      }
    },
  })
  const cancel = () => {
    target.value = undefined
  }
  const confirm = () => {
    onConfirm(target.value as any)
    target.value = undefined
  }
  const show = (t: T) => {
    target.value = (t) as any
  }
  return {
    target,
    model,
    show,
    cancel,
    confirm,
  }
}
