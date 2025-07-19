<template>
  <v-list-item :title="title">
    <template #prepend>
      <img
        class="mr-4"
        :src="icon"
        width="40"
      >
    </template>
    
    <template #subtitle>
      <a
        v-if="url.startsWith('http')"
        target="browser"
        :href="url"
      >{{ url }}</a>
      <template v-else>
        {{ url }}
      </template>
    </template>
    
    <template #append>
      <v-list-item-action class="w-60">
        <VersionMenu
          :items="items"
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
        >
          <template #default="{ props }">
            <v-text-field
              :model-value="value"
              variant="filled"
              density="compact"
              :placeholder="placeholder"
              hide-details
              append-inner-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              v-bind="props"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>
<script lang="ts" setup>
import VersionMenu from './VersionMenu.vue'

export interface VersionItem {
  tag?: string
  tagColor?: string
  name: string
  description?: string
}

defineProps<{
  icon: string
  title: string
  url: string
  placeholder: string

  value?: string

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
</script>
