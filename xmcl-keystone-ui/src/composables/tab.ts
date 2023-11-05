export function useTabMarketFilter() {
  const tab = ref(0)
  const disableModrinth = computed(() => tab.value !== 0 && tab.value !== 3)
  const disableCurseforge = computed(() => tab.value !== 0 && tab.value !== 2)
  const disableLocal = computed(() => tab.value !== 0 && tab.value !== 1)

  return {
    tab,
    disableModrinth,
    disableCurseforge,
    disableLocal,
  }
}
