import { InjectionKey, Ref } from 'vue'
import { filter as fuzzy } from 'fuzzy'
import { injection } from '@/util/inject'

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

export const kFilterCombobox: InjectionKey<ReturnType<typeof useFilterComboboxData>> = Symbol('FilterCombobox')

export function useFilterComboboxData() {
  const filteredText = ref('')
  const selectedFilterOptions = ref([] as Array<FilterOption | string>)
  const filterOptions: Ref<FilterOption[]> = ref([])
  function removeFilteredItem(index: number) {
    selectedFilterOptions.value = selectedFilterOptions.value.filter((v, i) => i !== index)
  }
  function clearFilterItems() {
    selectedFilterOptions.value = []
  }

  return {
    selectedFilterOptions,
    filterOptions,
    filteredText,
    clearFilterItems,
    removeFilteredItem,
  }
}

export function useFilterCombobox<T>(options: Ref<FilterOption[]>, getFilterOptions: (item: T) => FilterOption[], keywordExtractor: (item: T) => string) {
  const { selectedFilterOptions, filterOptions, filteredText } = injection(kFilterCombobox)

  watch(options, (ops) => { filterOptions.value = ops })

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

  return {
    filter,
  }
}
