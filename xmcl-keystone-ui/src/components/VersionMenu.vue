<template>
  <v-autocomplete
    :model-value="value"
    :items="items"
    :loading="refreshing"
    :disabled="disabled"
    :error="!!error"
    :clearable="isClearable"
    clear-icon="close"
    item-title="name"
    item-value="name"
    :return-object="false"
    :placeholder="placeholder ?? emptyText"
    :no-data-text="emptyText ?? ''"
    variant="outlined"
    density="compact"
    hide-details
    :hide-no-data="false"
    :menu-props="{ maxHeight: 360 }"
    @update:model-value="onSelect"
  >
    <template
      v-if="hasSnapshot"
      #prepend-inner
    >
      <v-btn
        v-shared-tooltip="() => snapshotTooltip"
        icon="bug_report"
        variant="text"
        density="compact"
        size="small"
        :color="snapshot ? 'primary' : undefined"
        @click.stop="emit('update:snapshot', !snapshot)"
      />
    </template>
    <template #append-inner>
      <v-btn
        icon="refresh"
        variant="text"
        density="compact"
        size="small"
        :loading="refreshing"
        @click.stop="emit('refresh')"
      />
    </template>
    <template #item="{ item, props: itemProps }">
      <v-list-item v-bind="itemProps">
        <template
          v-if="item.tag"
          #append
        >
          <v-chip
            label
            size="small"
            :color="item.tagColor"
          >
            {{ item.tag }}
          </v-chip>
        </template>
      </v-list-item>
    </template>
    <template #no-data>
      <ErrorView
        v-if="error"
        type="error"
        :error="error"
        @refresh="emit('refresh')"
      />
      <v-list-item v-else>
        <v-list-item-title>{{ emptyText }}</v-list-item-title>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'
import ErrorView from './ErrorView.vue'

export interface VersionItem {
  tag?: string
  tagColor?: string
  name: string
  description?: string
}

const props = defineProps<{
  value?: string
  placeholder?: string
  items: VersionItem[]
  refreshing?: boolean
  disabled?: boolean
  isClearable?: boolean
  clearText?: string
  emptyText?: string
  hasSnapshot?: boolean
  snapshot?: boolean
  snapshotTooltip?: string
  error?: any
}>()

const emit = defineEmits<{
  (event: 'update:snapshot', value: boolean): void
  (event: 'select', value: string): void
  (event: 'refresh'): void
}>()

watch(() => props.items, (newItems) => {
  // Only auto-clear when we actually have a loaded list to compare against.
  // An empty `items` array typically means the data is still loading (e.g.
  // when the component is freshly mounted after switching tabs), and
  // clearing the value in that case would spuriously mark the instance as
  // modified.
  if (newItems.length === 0) return
  if (props.value && !newItems.some((item) => item.name === props.value)) {
    emit('select', '')
  }
}, { immediate: true })


const onSelect = (val: string | null) => {
  emit('select', val ?? '')
}
</script>
