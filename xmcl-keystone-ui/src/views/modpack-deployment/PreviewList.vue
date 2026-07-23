<template>
  <section class="surface-panel p-4">
    <h3 class="mb-3 font-medium">{{ title }}</h3>
    <div v-if="items.length" class="flex flex-col gap-2 text-sm">
      <div
        v-for="item in items"
        :key="`${item.change}:${item.path}`"
        class="flex min-w-0 items-center gap-2"
      >
        <ChangeChip :change="item.change" />
        <span class="truncate font-mono" :title="item.path">{{ item.path }}</span>
      </div>
    </div>
    <div v-else class="text-sm opacity-60">No changes</div>
  </section>
</template>

<script setup lang="ts">
import ChangeChip from './ChangeChip.vue'

defineProps<{
  title: string
  items: Array<{
    path: string
    change: 'add' | 'replace' | 'remove' | 'unchanged'
  }>
}>()
</script>
