import { Ref } from 'vue'
import { useFilterCombobox } from './filterCombobox'
import { ModItem } from './instanceModItems'

export function useModFilter(items: Ref<ModItem[]>) {
  function getFilterOptions(item: ModItem) {
    return [
      ...item.mod.modLoaders.map(tag => ({ label: 'info', value: tag, color: 'lime' })),
      { value: item.mod.modId, color: 'orange en-1' },
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox<ModItem>(filterOptions, getFilterOptions, (v) => `${v.mod.name} ${v.mod.version}`)

  const filtered = computed(() => filter(items.value))

  return {
    items: filtered,
  }
}
