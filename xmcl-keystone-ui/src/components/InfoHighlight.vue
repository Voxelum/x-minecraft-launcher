<template>
  <span>
    <div class="text-center text-2xl font-bold text-gray-600 dark:text-gray-300">
      {{ value.value }}
    </div>
    <div
      class="flex w-full items-center justify-center"
    >
      <v-icon
        class="material-icons-outlined"
        left
        small
      >
        {{ value.icon }}
      </v-icon>
      <span class="whitespace-nowrap">{{ value.name }}</span>
    </div>
  </span>
</template>
<script setup lang="ts">
export interface Highlight {
  value: string | number
  icon: string
  name: string
}
defineProps<{
  value: Highlight
}>()
</script>
