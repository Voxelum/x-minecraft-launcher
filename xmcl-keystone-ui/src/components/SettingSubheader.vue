<template>
  <v-subheader style="padding-right: 2px; z-index: 4">
      {{ title }}
      <v-spacer />
      <slot />
  </v-subheader>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>