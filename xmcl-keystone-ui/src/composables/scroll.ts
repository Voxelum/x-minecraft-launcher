import { Ref, onMounted } from 'vue'

export function useScrollToOnMount(elem: Ref<null | import('vue').default | HTMLElement>, computeOffset: () => number) {
  onMounted(() => {
    const yOffset = computeOffset()
    const elemValue = elem.value
    if (!elemValue) return
    if (elemValue instanceof HTMLElement) {
      elemValue.scrollTo(0, yOffset)
    } else {
      elemValue.$el.scrollTo(0, yOffset)
    }
  })
}
