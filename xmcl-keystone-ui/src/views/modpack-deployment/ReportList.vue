<template>
  <section class="surface-panel p-4">
    <h3 class="mb-3 flex items-center gap-2 font-medium">
      <v-icon size="18">{{ icon }}</v-icon>
      {{ title }}
      <v-chip size="x-small">{{ items.length }}</v-chip>
    </h3>
    <div v-if="items.length" class="max-h-48 overflow-auto">
      <div
        v-for="item in items"
        :key="item"
        class="truncate py-1 font-mono text-sm"
        :title="item"
      >
        {{ item }}
      </div>
    </div>
    <div v-else class="text-sm opacity-60">{{ emptyLabel }}</div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  icon: string
  items: string[]
  emptyLabel: string
}>()
</script>
