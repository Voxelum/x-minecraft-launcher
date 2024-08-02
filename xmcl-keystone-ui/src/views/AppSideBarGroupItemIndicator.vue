<template>
  <div
    class="absolute left-0 px-2"
    :style="{
      top: state === 0 ? '0' : '',
      bottom: state === 2 ? '0' : '',
      minHeight: state !== 1 ? '4px' : '100%',
      minWidth: state !== 1 ? '100%' : '4px',
    }"
  >
    <div
      class="transition-300 rounded transition-colors"
      :class="{ 'bg-yellow-400': typeof state === 'number' }"
      style="min-width: inherit; min-height: inherit;"
    >
      {{ ' ' }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  state?: number | undefined
}>()
</script>
