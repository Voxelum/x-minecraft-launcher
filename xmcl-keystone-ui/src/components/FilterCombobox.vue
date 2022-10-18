<template>
  <v-combobox
    v-model="selectedFilterOptions"
    v-focus-on-search="() => true"
    tabindex="0"
    :items="filterOptions"
    :label="label"
    :search-input.sync="filterTextBuffer"
    item-text="value"
    chips
    clearable
    hide-details
    :allow-overflow="true"
    prepend-inner-icon="filter_list"
    multiple
    solo
    flat
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
import { vFocusOnSearch } from '../directives/focusOnSearch'
import debounce from 'lodash.debounce'

defineProps<{ label: String }>()

const model = inject(FilterCombobox)
if (!model) { throw new Error('Please call useFilterCombobox in upper level') }

const filterTextBuffer = ref(model.filteredText.value)

const debounceSetText = debounce((v: string) => {
  filteredText.value = v
}, 450)

watch(filterTextBuffer, (newVal) => {
  debounceSetText(newVal)
})

watch(model.filteredText, (newVal) => {
  filterTextBuffer.value = newVal
})

const {
  selectedFilterOptions,
  filterOptions,
  filteredText,
  clearFilterItems,
  removeFilteredItem,
} = model

</script>
