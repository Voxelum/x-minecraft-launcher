<template>
  <v-list-item
    :key="source.name"
    ripple
    @click="select(source.name)"
  >
    {{ source.name }}
    <div class="flex-grow" />
    <v-chip
      v-if="source.tag"
      label
      :color="source.tagColor"
    >
      {{ source.tag }}
    </v-chip>
  </v-list-item>
</template>

<script lang=ts setup>
import { VersionMenuItem } from '../composables/versionList'
defineProps<{
  source: VersionMenuItem
  select(version: string): void
}>()
</script>
