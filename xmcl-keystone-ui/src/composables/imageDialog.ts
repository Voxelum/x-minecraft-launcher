import { InjectionKey } from 'vue'

export function useImageDialog() {
  const image = ref('')
  const description = ref('')
  const date = ref('')
  const isShown = ref(false)

  const show = (src: string, options?: { description?: string; date?: string }) => {
    image.value = src
    description.value = options?.description ?? ''
    date.value = options?.date ?? ''
    isShown.value = true
  }

  watch(isShown, (v) => {
    if (!v) image.value = ''
  })

  return {
    show,
    image,
    description,
    date,
    isShown,
  }
}

export const kImageDialog: InjectionKey<ReturnType<typeof useImageDialog>> = Symbol('ImageDialog')
