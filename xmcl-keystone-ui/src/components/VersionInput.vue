<template>
  <div class="version-input flex items-center gap-4 px-4 py-2">
    <img
      :src="icon"
      class="flex-shrink-0"
      width="40"
      height="40"
    >
    <div class="flex flex-col flex-1 min-w-0">
      <div class="text-sm font-weight-medium">
        {{ title }}
      </div>
      <div class="text-xs opacity-70 overflow-hidden text-ellipsis whitespace-nowrap">
        <a
          v-if="url.startsWith('http')"
          target="browser"
          :href="url"
        >{{ url }}</a>
        <template v-else>
          {{ url }}
        </template>
      </div>
    </div>
    <div class="w-60 flex-shrink-0">
      <VersionMenu
        :value="value"
        :items="items"
        :placeholder="placeholder"
        :refreshing="refreshing"
        :disabled="disabled"
        :is-clearable="isClearable"
        :error="error"
        :clear-text="clearText"
        :empty-text="emptyText"
        :has-snapshot="hasSnapshot"
        :snapshot="snapshot"
        :snapshot-tooltip="snapshotTooltip"
        @update:snapshot="emit('update:snapshot', $event)"
        @select="emit('input', $event)"
        @refresh="emit('refresh')"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import VersionMenu from './VersionMenu.vue'

export interface VersionItem {
  tag?: string
  tagColor?: string
  name: string
  description?: string
}

const props = defineProps<{
  icon: string
  title: string
  url: string
  placeholder: string

  value?: string
  autoSelect?: string

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
  (event: 'input', value: string): void
  (event: 'refresh'): void
  (event: 'update:snapshot', value: boolean): void
}>()

const autoSelected = ref(false)

watch([() => props.autoSelect, () => props.items], ([autoSelect, newItems]) => {
  if (!autoSelect || autoSelected.value || !newItems.some((item) => item.name === autoSelect)) return
  autoSelected.value = true
  emit('input', autoSelect)
}, { immediate: true })
</script>
