<template>
  <v-card class="setting-card" elevation="2">
    <v-card-title v-if="title" class="text-subtitle-1 pb-2 select-none">
      <v-icon left :color="color || 'primary'" small v-if="icon">{{ icon }}</v-icon>
      {{ title }}
    </v-card-title>
    <v-card-subtitle v-if="subtitle" class="pb-0">
      {{ subtitle }}
    </v-card-subtitle>
    <v-card-text class="px-4 py-4">
      <slot />
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
defineProps<{
  title?: string
  color?: string
  subtitle?: string
  icon?: string
}>()
</script>
<style scoped>
.setting-card {
  border-radius: 12px;
}
</style>
