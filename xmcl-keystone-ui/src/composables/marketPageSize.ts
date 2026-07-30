import { createSharedComposable, useLocalStorage } from '@vueuse/core'

/**
 * The selectable page sizes for the market search (mod / resourcepack / shader
 * / save browsing). A larger page fetches more results per request, so the
 * user hits "load more" less often — useful when the Modrinth/CurseForge
 * response feels slow because each round-trip only returned a handful of hits.
 */
export const MARKET_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

const MIN_PAGE_SIZE = MARKET_PAGE_SIZE_OPTIONS[0]
const MAX_PAGE_SIZE = MARKET_PAGE_SIZE_OPTIONS[MARKET_PAGE_SIZE_OPTIONS.length - 1]

/**
 * Shared singleton so the filter panel control and every search composable
 * (modrinth / curseforge) read and write the SAME ref. Persisted to
 * localStorage so the preference survives restarts.
 */
export const useMarketPageSize = createSharedComposable(() => {
  const raw = useLocalStorage('marketPageSize', MIN_PAGE_SIZE)

  // Guard against corrupt/legacy values so downstream offset math stays sane.
  const pageSize = computed({
    get: () => {
      const v = raw.value
      if (typeof v !== 'number' || Number.isNaN(v)) return MIN_PAGE_SIZE
      return Math.min(Math.max(v, MIN_PAGE_SIZE), MAX_PAGE_SIZE)
    },
    set: (v: number) => {
      raw.value = Math.min(Math.max(v, MIN_PAGE_SIZE), MAX_PAGE_SIZE)
    },
  })

  return { pageSize }
})
