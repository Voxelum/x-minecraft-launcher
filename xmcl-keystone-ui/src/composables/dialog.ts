import { computed, InjectionKey, markRaw, Ref, ref, shallowRef, ShallowRef, toRaw, watch } from 'vue'

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

interface DialogBroadcastChannel {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  postMessage(message: DialogModelData<any>): void
}

export function useDialogModel(
  channel: DialogBroadcastChannel = new BroadcastChannel('dialog'),
): DialogModel {
  const model = shallowRef({ dialog: '', parameter: undefined })
  const remoteValues = new WeakSet<object>()

  channel.addEventListener('message', (e) => {
    const value = e.data
    if (!value || typeof value !== 'object' || typeof value.dialog !== 'string') return
    if (value.dialog === model.value.dialog) return
    remoteValues.add(value)
    model.value = value
  })
  watch(model, (value) => {
    if (remoteValues.delete(value)) return
    try {
      const rawParam = value.parameter ? toRaw(value.parameter) : undefined
      const cleanParam = rawParam ? JSON.parse(JSON.stringify(rawParam)) : undefined
      channel.postMessage({
        dialog: value.dialog,
        parameter: cleanParam,
      })
    } catch (e) {
      console.warn('Failed to postMessage for dialog:', e)
    }
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

export function useSimpleDialog<T>(onConfirm: (target: T | undefined) => void, onCancel?: (target: T | undefined) => void) {
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
    onCancel?.(target.value as any)
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
