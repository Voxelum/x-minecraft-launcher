<template>
  <v-list-item
    :key="source.name"
    :class="{
      dark: source.isSelected,
      selected: source.isSelected,
      'en-1': source.isSelected,
      'elevation-2': source.isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <div class="w-30">
      <v-chip
        v-if="source.tag"
        :color="source.tagColor"
        label
      >
        {{ source.tag }}
      </v-chip>
    </div>

    <v-list-item-title class="pl-3">
      {{ source.name }}
    </v-list-item-title>
    <v-list-item-subtitle>{{ source.description }}</v-list-item-subtitle>

    <v-list-item-action style="justify-content: flex-end;">
      <v-btn
        :loading="loading"
        icon
        @click.stop="source.status === 'remote' ? refresh() : show(source)"
      >
        <v-icon>
          {{
            source.status === "remote" ? "file_download" : "folder"
          }}
        </v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts setup>
import { VersionItem } from '../composables/versionList'
import { useRefreshable } from '@/composables'

const props = defineProps<{
  source: VersionItem
  install(item: object): Promise<void>
  show(item: VersionItem): void
  select(item: VersionItem): void
}>()

const { refresh, refreshing } = useRefreshable(() => {
  return props.install(props.source.instance)
})
const loading = computed(() => refreshing.value || props.source.status === 'installing')

</script>

<style scoped>
.dark .selected {
  background: rgba(234, 233, 255, 0.2);
}

.selected {
  background: rgba(0, 0, 0, 0.1);
}

</style>
