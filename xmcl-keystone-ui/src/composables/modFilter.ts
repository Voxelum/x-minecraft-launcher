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
    for (const mod of filteredCompatbile.value) {
      if (mod.enabledState) {
        if (enabled[mod.name]) {
          mod.subsequence = true
          enabled[mod.name].push(mod)
        } else {
          enabled[mod.name] = [mod]
        }
      } else {
        if (disabled[mod.name]) {
          mod.subsequence = true
          disabled[mod.name].push(mod)
        } else {
          disabled[mod.name] = [mod]
        }
      }
    }
    const grouped: ModItem[] = []
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
