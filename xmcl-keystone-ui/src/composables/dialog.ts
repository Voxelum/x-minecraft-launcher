import { computed, InjectionKey, Ref, ref, ShallowRef } from 'vue'

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

export type DialogModelData<T> = {
  dialog: string
  parameter: T
}

export interface DialogControl {
  isShown: Ref<boolean>
  parameter: Ref<any>
  show: (param?: any) => void
  hide: () => void
}

export type DialogModel = {
  current: ShallowRef<DialogModelData<any>>
  registered: Record<string, DialogControl>
}

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
  return {
    current: model,
    registered: markRaw({}),
  }
}

export interface DialogKey<T> extends String { }

function getOrCreate(model: DialogModel, dialogName: DialogKey<any>) {
  const key = `dialog-${dialogName}`

  const cached = inject(key, undefined)
  if (cached) return cached as DialogControl

  const current = model.current
  const isShown = computed({
    get: () => {
      return current.value.dialog === dialogName
    },
    set: (v: boolean) => {
      if (v) {
        show()
      } else {
        hide()
      }
    },
  })
  function hide() {
    if (current.value.dialog === dialogName) {
      current.value = { dialog: '', parameter: undefined }
    }
  }
  function show(param?: any) {
    if (current.value.dialog === dialogName) return
    current.value = { dialog: dialogName as string, parameter: param }
  }

  provide(key, {
    isShown,
    parameter: computed(() => isShown.value ? current.value.parameter : undefined),
    show,
    hide,
  })

  return {
    isShown,
    parameter: computed(() => isShown.value ? current.value.parameter : undefined),
    show,
    hide,
  }
}

/**
 * Use a shared dialog between pages
 */
export function useDialog<T = any>(dialogName: DialogKey<T> = '', onShown?: (param: T) => void, onHide?: () => void) {
  const model = injection(kDialogModel)
  const { parameter, isShown, show, hide } = getOrCreate(model, dialogName)

  if (onShown || onHide) {
    watch(isShown, (value) => {
      if (value) {
        onShown?.(model.current.value.parameter)
      } else {
        onHide?.()
      }
    })
  }

  return {
    parameter: parameter as Ref<T | undefined>,
    show: show as (param?: T) => void,
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
