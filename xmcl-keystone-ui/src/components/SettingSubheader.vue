<script setup lang="ts">
defineProps<{
  title: string
  padded?: boolean
}>()
</script>

<template>
  <div
    class="v-list-subheader"
    :class="{ padded: padded }"
  >
    <div class="v-list-subheader__text">
      {{ title }}
    </div>
    <VSpacer />
    <slot />
  </div> 
</template>

<style scoped>
.v-list-subheader.padded {
  @apply px-4 flex flex-row gap-1;
}
</style>