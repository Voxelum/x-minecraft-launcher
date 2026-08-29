import type { Ref } from 'vue'

export function clearSearch(
  keyword: Ref<string>,
  emit: (event: 'clear') => void,
) {
  keyword.value = ''
  emit('clear')
}
