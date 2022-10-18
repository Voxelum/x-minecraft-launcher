import { InjectionKey, Ref } from 'vue'
import { filter as fuzzy } from 'fuzzy'

export interface FilterOption {
  /**
   * The label of the tag
   */
  label?: string
  /**
   * The value to filter
   */
  value: string
  /**
   * The color of the tag
   */
  color?: string
}

export const FilterCombobox: InjectionKey<ReturnType<typeof useFilterCombobox>> = Symbol('FilterCombobox')

export function useFilterCombobox<T>(filterOptions: Ref<FilterOption[]>, getFilterOptions: (item: T) => FilterOption[], keywordExtractor: (item: T) => string) {
  const filteredText = ref('')
  const selectedFilterOptions = ref([] as Array<FilterOption | string>)

  function isValidItem(item: T) {
    const tags = selectedFilterOptions.value.filter(v => typeof v === 'object')
    if (tags.length === 0) return true
    let valid = false
    const options = getFilterOptions(item)
    for (const tag of tags) {
      const match = options.some(t => t.value === (tag as any).value)
      if (match) {
        valid = true
      }
    }
    return valid
  }
  function filter(items: T[]) {
    const keyword = filteredText.value ? filteredText.value : (selectedFilterOptions.value.find(i => typeof i === 'string') as string)
    const baseItems = keyword
      ? fuzzy(keyword, items, { extract: keywordExtractor }).map((r) => r.original ? r.original : r as any as T)
      : items
    return baseItems.filter(isValidItem)
  }

  function removeFilteredItem(index: number) {
    selectedFilterOptions.value = selectedFilterOptions.value.filter((v, i) => i !== index)
  }
  function clearFilterItems() {
    selectedFilterOptions.value = []
  }

  provide(FilterCombobox, {
    selectedFilterOptions,
    filterOptions,
    filteredText,
    filter: filter as any,
    removeFilteredItem,
    clearFilterItems,
  })

  return {
    selectedFilterOptions,
    filterOptions,
    filteredText,
    filter,
    removeFilteredItem,
    clearFilterItems,
  }
}
