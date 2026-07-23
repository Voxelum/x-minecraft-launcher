<template>
  <v-chip
    size="x-small"
    :color="colors[change]"
  >
    {{ change }}
  </v-chip>
</template>

<script setup lang="ts">
defineProps<{
  change: 'add' | 'replace' | 'remove' | 'unchanged'
}>()

const colors = {
  add: 'success',
  replace: 'warning',
  remove: 'error',
  unchanged: 'grey',
} as const
</script>
