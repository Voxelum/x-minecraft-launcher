<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="icon"
        width="40"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>{{ title }}</v-list-item-title>
      <v-list-item-subtitle>
        <a
          v-if="url.startsWith('http')"
          target="browser"
          :href="url"
        >{{ url }}</a>
        <template v-else>
          {{ url }}
        </template>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
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
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            :placeholder="placeholder"
            hide-details
            append-icon="arrow_drop_down"
            persistent-hint
            :readonly="true"
            @click:append="on.click($event);"
            v-on="on"
          />
        </template>
      </VersionMenu>
    </v-list-item-action>
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
