<template>
  <div
    class="flex flex-grow-0 items-center rounded pr-2 text-sm"
    @click="emit('click', $event)"
  >
    <v-avatar
      :left="true"
      class="hidden lg:block"
      style="height: 34px; width: 34px"
      :class="{ responsive }"
    >
      <img
        v-if="avatar"
        :src="avatar"
      >
      <v-icon v-else-if="icon">
        {{ icon }}
      </v-icon>
    </v-avatar>

    <div
      v-if="text"
      class="text overflow-hidden overflow-ellipsis whitespace-nowrap"
    >
      <div
        class="select-none font-semibold dark:text-gray-300"
        :style="{
          color: bgColor
        }"
      >
        {{ title }}
      </div>
      {{ text }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useVuetifyColor } from '@/composables/vuetify'

const props = defineProps<{
  color?: string
  avatar?: string
  icon?: string
  title?: string
  text?: string
  responsive?: boolean
}>()
const { getColorCode } = useVuetifyColor()
const bgColor = computed(() => props.color ? getColorCode(props.color) : undefined)
const emit = defineEmits(['click'])
</script>
<style scoped>

.responsive {
  display: none !important;
}
.text {
  padding-left: 0.5rem;
}
@media (min-width: 1000px) {
  .responsive {
    display: block !important;
  }
  .text {
    padding-left: 0rem;
  }
}
</style>
