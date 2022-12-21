import debounce from 'lodash.debounce'
import { Ref } from 'vue'
import { useFilterCombobox } from './filterCombobox'
import { ModItem } from './mod'

export function useModFilter(items: Ref<ModItem[]>) {
  function getFilterOptions(item: ModItem) {
    return [
      ...item.modLoaders.map(tag => ({ label: 'info', value: tag, color: 'lime' })),
      { value: item.id, color: 'orange en-1' },
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const modLoaderFilters = ref(['forge', 'fabric', 'quilt', 'optifine'] as string[])
  const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox<ModItem>(filterOptions, getFilterOptions, (v) => `${v.name} ${v.version}`)
  const modLoaderRecord = ref(new Set(modLoaderFilters.value))

  const updateModLoaderSet = debounce(() => {
    modLoaderRecord.value = new Set(modLoaderFilters.value)
  }, 700)

  watch(modLoaderFilters, updateModLoaderSet)

  function isCompatibleMod(mod: ModItem) {
    if (mod.enabled) {
      return true
    }
    for (const loader of mod.modLoaders) {
      // is modloader is disabled?
      if (!modLoaderRecord.value.has(loader)) {
        return false
      }
    }
    return true
  }

  const filtered = computed(() => filter(items.value))
  const filteredCompatbile = computed(() => filtered.value.filter(isCompatibleMod))
  const mods = computed(() => {
    const enabled: Record<string, ModItem[]> = {}
    const disabled: Record<string, ModItem[]> = {}
    const modified: ModItem[] = []
    for (const mod of filteredCompatbile.value) {
      if (mod.enabledState) {
        if (enabled[mod.id]) {
          mod.subsequence = true
          enabled[mod.id].push(mod)
        } else {
          enabled[mod.id] = [mod]
        }
      } else if (mod.enabledState !== mod.enabled) {
        modified.push(mod)
      } else {
        if (disabled[mod.id]) {
          mod.subsequence = true
          disabled[mod.id].push(mod)
        } else {
          disabled[mod.id] = [mod]
        }
      }
    }
    const grouped: ModItem[] = [...modified]
    for (const mod of Object.values(enabled)) {
      grouped.push(...mod)
    }
    for (const mod of Object.values(disabled)) {
      grouped.push(...mod)
    }
    return grouped
  })

  return {
    items: mods,
    modLoaderFilters,
  }
}
