<template>
  <v-combobox
    v-model="selectedFilterOptions"
    v-focus-on-search="() => { resetKeyword(); return true}"
    tabindex="0"
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
    flat
    @click.capture="resetKeyword"
    @click:clear="clearFilterItems"
  >
    <template #item="{ item, attrs }">
      <div class="w-full flex flex-grow-0 items-center">
        <v-list-item-action>
          <v-checkbox
            :value="attrs.inputValue"
            hide-details
          />
        </v-list-item-action>
        <v-chip
          label
          outlined
          :color="item.color ? item.color : getColor(item.value)"
        >
          <v-icon left>
            {{ item.label ? item.label : 'label' }}
          </v-icon>
          {{ item.value }}
        </v-chip>
      </div>
    </template>
    <template #selection="{ index, item, selected }">
      <v-chip
        v-if="typeof item === 'object'"
        label
        outlined
        :color="item.color ? item.color : getColor(item.value)"
        :input-value="selected"
        close
        @click:close="removeFilteredItem(index)"
      >
        <v-icon
          v-if="item.label"
          left
        >
          {{ item.label }}
        </v-icon>
        {{ item.value }}
      </v-chip>
      <v-chip
        v-else
        label
        outlined
        :input-value="selected"
        close
        @click:close="removeFilteredItem(index)"
      >
        <!-- <v-icon left v-if="item.label">{{ item.label }}</v-icon> -->
        {{ item }}
      </v-chip>
    </template>
  </v-combobox>
</template>
<script lang="ts" setup>
import { getColor } from '../util/color'
import { FilterCombobox } from '../composables'
import { vFocusOnSearch } from '../windows/main/directives/focusOnSearch'

defineProps<{ label: String }>()

const model = inject(FilterCombobox)
if (!model) { throw new Error('Please call useFilterCombobox in upper level') }

const resetKeyword = () => {
  const keyword = model.selectedFilterOptions.value.find(v => typeof v === 'string') as string | undefined
  model.selectedFilterOptions.value = model.selectedFilterOptions.value.filter(v => typeof v === 'object')
  if (keyword) {
    model.filteredText.value = keyword
  }
}
// onSearchToggle(() => {
//   if (searchElem.value) {
//     searchElem.value.focus()
//     resetKeyword()
//     model.filteredText.value = ''
//   }
//   return true
// })

const {
  selectedFilterOptions,
  filterOptions,
  filteredText,
  clearFilterItems,
  removeFilteredItem,
} = model

</script>
