import { ref } from 'vue'
import type { BlueprintMarketItem, BlueprintMarketProvider, BlueprintMarketSearchOptions, BlueprintMarketSearchResult } from '@xmcl/runtime-api'

/** Each search owns its pagination; superseded requests must not publish state. */
export function useBlueprintMarketSearch(
  providers: BlueprintMarketProvider[],
  search: (options: BlueprintMarketSearchOptions) => Promise<BlueprintMarketSearchResult>,
  reportError: (message: string) => void,
) {
  const items = ref<BlueprintMarketItem[]>([])
  const loading = ref(false)
  let generation = 0
  let keyword = ''
  let state: Record<string, { page: number; hasMore: boolean }> = {}

  async function load() {
    if (loading.value) return
    const toLoad = providers.filter(p => state[p]?.hasMore)
    if (!toLoad.length) return
    const current = generation
    const pages = toLoad.map(p => state[p].page)
    loading.value = true
    try {
      const results = await Promise.allSettled(toLoad.map((provider, i) => search({ provider, keyword, page: pages[i] })))
      if (current !== generation) return
      const lists: BlueprintMarketItem[][] = []
      let failures = 0
      results.forEach((result, i) => {
        const provider = toLoad[i]
        if (result.status === 'fulfilled') {
          lists.push(result.value.items)
          state[provider] = { page: pages[i] + 1, hasMore: result.value.hasMore }
        } else {
          failures++
          state[provider] = { page: pages[i], hasMore: false }
        }
      })
      const mixed: BlueprintMarketItem[] = []
      const length = Math.max(0, ...lists.map(l => l.length))
      for (let i = 0; i < length; i++) for (const list of lists) if (list[i]) mixed.push(list[i])
      items.value = [...items.value, ...mixed]
      if (failures === toLoad.length && !items.value.length) reportError('Failed to search blueprint market.')
    } finally {
      if (current === generation) loading.value = false
    }
  }
  function reset(value: string) {
    generation++
    keyword = value
    items.value = []
    loading.value = false
    reportError('')
    state = Object.fromEntries(providers.map(p => [p, { page: 0, hasMore: true }]))
    return load()
  }
  return { items, loading, load, reset }
}
