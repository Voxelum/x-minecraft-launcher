<template>
  <v-combobox
    ref="searchElem"
    tabindex="0"
    v-model="selectedFilterOptions"
    :items="filterOptions"
    :label="label"
    :search-input.sync="filteredText"
    item-text="value"
    chips
    clearable
    hide-details
    :allow-overflow="true"
    prepend-inner-icon="filter_list"
    multiple
    solo
    @click:clear="clearFilterItems"
  >
    <template v-slot:item="{ index, item, tile }">
      <v-list-tile-action>
        <v-checkbox :value="tile.props.value" hide-details />
      </v-list-tile-action>
      <v-chip label outline :color="item.color ? item.color : getColor(item.value)">
        <v-icon left>{{ item.label ? item.label : 'label' }}</v-icon>
        {{ item.value }}
      </v-chip>
    </template>
    <template v-slot:selection="{ index, item, selected }">
      <v-chip
        label
        outline
        v-if="typeof item === 'object'"
        :color="item.color ? item.color : getColor(item.value)"
        :selected="selected"
        close
        @input="removeFilteredItem(index)"
      >
        <v-icon left v-if="item.label">{{ item.label }}</v-icon>
        {{ item.value }}
      </v-chip>
      <v-chip v-else label outline :selected="selected" close @input="removeFilteredItem(index)">
        <!-- <v-icon left v-if="item.label">{{ item.label }}</v-icon> -->
        {{ item }}
      </v-chip>
    </template>
  </v-combobox>
</template>
<script lang="ts">
import { defineComponent, inject, InjectionKey, nextTick, onMounted, provide, Ref, ref } from '@vue/composition-api'
import { filter as fuzzy } from 'fuzzy'
import { getColor } from '../util/color'
import { required } from '../util/props'
import { onSearchToggle } from '../windows/main/hooks'

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

const FilterCombobox: InjectionKey<ReturnType<typeof useFilterCombobox>> = Symbol('FilterCombobox')

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
    filter,
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

export default defineComponent({
  props: {
    label: required(String)
  },
  setup() {
    const searchElem = ref(null as null | any)
    const model = inject(FilterCombobox)
    if (!model) { throw new Error('Please call useFilterCombobox in upper level') }
    const resetKeyword = () => {
      const keyword = model.selectedFilterOptions.value.find(v => typeof v === 'string') as string | undefined
      model.selectedFilterOptions.value = model.selectedFilterOptions.value.filter(v => typeof v === 'object')
      if (keyword) {
        model.filteredText.value = keyword
      }
    }
    onSearchToggle(() => {
      if (searchElem.value) {
        searchElem.value.focus()
        resetKeyword()
        model.filteredText.value = ''
      }
      return true
    })
    onMounted(() => {
      const elem = searchElem.value!.$el as HTMLElement
      elem.addEventListener('click', resetKeyword)
    })
    return { ...model, searchElem, getColor }
  },
})

</script>