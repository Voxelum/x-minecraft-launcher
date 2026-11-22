<template>
  <v-img v-if="isImage" v-bind="$attrs" :src="icon" :width="size" :height="size" contain />
  <v-icon v-else-if="icon" v-bind="$attrs" :size="size" :color="color">
    {{ icon }}
  </v-icon>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    icon?: string
    size?: string | number
    color?: string
  }>(),
  {
    size: 24,
  },
)

const isImage = computed(() => /\.(svg|png|webp)(?:$|[?#])/i.test(props.icon ?? ''))
</script>
