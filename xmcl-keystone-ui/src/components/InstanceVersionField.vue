<template>
  <v-text-field
    variant="solo"
    flat
    density="compact"
    :label="label"
    :model-value="value"
    readonly
  >
    <template #prepend-inner>
      <img
        :src="image"
        width="32"
      >
    </template>
  </v-text-field>
</template>
<script lang="ts" setup>
defineProps<{
  label: string
  value: string
  image: string
}>()
</script>
