<template>
  <div
    class="absolute left-0 rounded z-10"
    :style="{
      top: state === 0 ? '0' : '',
      bottom: state === 2 ? '0' : '',
      minHeight: state !== 1 ? '4px' : '16px',
      minWidth: state !== 1 ? '100%' : '16px',
    }"
    :class="{ 'bg-yellow-400': typeof state === 'number' && state !== 1 }"
  >
    <v-icon v-if="state === 1">
      folder
    </v-icon>
    <span v-else>
      {{ ' ' }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  state?: number | undefined
}>()
// const state = ref(1)
</script>
