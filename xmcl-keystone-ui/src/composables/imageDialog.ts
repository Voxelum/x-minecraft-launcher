import { InjectionKey } from 'vue'

export interface ImageData {
  src: string
  description?: string
  date?: string
}

export function useImageDialog() {
  const all = shallowRef<ImageData[]>([])
  const index = ref(0)
  const image = computed(() => all.value[index.value]?.src ?? '')
  const description = computed(() => all.value[index.value]?.description ?? '')
  const date = computed(() => all.value[index.value]?.date ?? '')
  const isShown = ref(false)

  const show = (src: string | ImageData) => {
    all.value = typeof src === 'string' ? [{ src }] : [src]
    index.value = 0
    isShown.value = true
  }

  const showAll = (images: (string | ImageData)[], start?: number) => {
    all.value = images.map((i) => (typeof i === 'string' ? { src: i } : i))
    index.value = start ?? 0
    isShown.value = true
  }

  watch(isShown, (v) => {
    if (!v) {
      all.value = []
      index.value = 0
    }
  })

  const next = () => {
    if (all.value.length === 0) return
    index.value = (index.value + 1) % all.value.length
  }

  const prev = () => {
    if (all.value.length === 0) return
    index.value = (index.value - 1 + all.value.length) % all.value.length
  }

  const totalImages = computed(() => all.value.length)
  const hasMultipleImages = computed(() => all.value.length > 1)
  const currentIndex = computed(() => index.value + 1) // 1-based for display

  return {
    showAll,
    show,
    image,
    description,
    date,
    isShown,
    next,
    prev,
    totalImages,
    hasMultipleImages,
    currentIndex,
  }
}

export const kImageDialog: InjectionKey<ReturnType<typeof useImageDialog>> = Symbol('ImageDialog')
