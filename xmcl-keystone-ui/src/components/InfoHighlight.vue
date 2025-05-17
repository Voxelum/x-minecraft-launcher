<template>
  <span>
    <div
      class="text-center font-bold text-gray-600 dark:text-gray-300"
      :class="{
        'text-nowrap': dense,
        'text-2xl': !dense,
        'text-sm': dense,
      }"
    >
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
      <span class="whitespace-nowrap" :class="{ 'text-sm': dense }">{{ value.name }}</span>
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
  dense?: boolean
  value: Highlight
}>()
</script>
