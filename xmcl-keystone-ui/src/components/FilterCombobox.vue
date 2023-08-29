<template>
  <v-combobox
    ref="filterCombobox"
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
    hide-no-data
    :allow-overflow="true"
    class="filter-combobox invisible-scroll"
    prepend-inner-icon="filter_list"
    multiple
    outlined
    dense
    :height="46"
    :placeholder="placeholder"
    filled
    @click:clear="clearFilterItems"
    @wheel.native="onWheel"
  >
    <template #item="{ item, attrs }">
      <div class="flex w-full flex-grow-0 items-center">
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
        class="overflow-visible"
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
        class="overflow-visible"
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
import { kFilterCombobox, useScrollRight } from '../composables'
import { vFocusOnSearch } from '../directives/focusOnSearch'
import debounce from 'lodash.debounce'

defineProps<{ label?: string; placeholder?: string }>()

const model = inject(kFilterCombobox)
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

const filterCombobox = ref(null as any)
const container = ref(null as any)
onMounted(() => {
  const el = filterCombobox.value.$el as HTMLElement
  container.value = el.querySelector('.v-select__selections')
})

const { onWheel } = useScrollRight(container)

</script>
<style>
.filter-combobox .v-select__selections {
  flex-wrap: nowrap !important;
  overflow-x: auto !important;
}
</style>
