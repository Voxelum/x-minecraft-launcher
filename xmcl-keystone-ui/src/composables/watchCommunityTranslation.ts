import { Ref, watch } from 'vue'

/** Keep optional translated content tied to both the project and its language. */
export function watchCommunityTranslation<T extends string | number>(
  projectId: Ref<T>,
  locale: Ref<string>,
  content: Ref<string>,
  getContent: (id: T) => Promise<string>,
) {
  return watch([projectId, locale], async ([id, language]) => {
    content.value = ''
    const result = await getContent(id)
    if (id === projectId.value && language === locale.value) {
      content.value = result
    }
  }, { immediate: true })
}
