import { InjectionKey } from 'vue'

export function useImageDialog() {
  const image = ref('')
  const isShown = ref(false)

  const show = (src: string) => {
    image.value = src
    isShown.value = true
  }

  watch(isShown, (v) => {
    if (!v) image.value = ''
  })

  return {
    show,
    image,
    isShown,
  }
}

export const kImageDialog: InjectionKey<ReturnType<typeof useImageDialog>> = Symbol('ImageDialog')
