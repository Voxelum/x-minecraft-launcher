<template>
  <img
    :src="src"
    :width="width"
  >
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  width?: number
  src: string
}>(), {
  width: 24,
})
</script>
